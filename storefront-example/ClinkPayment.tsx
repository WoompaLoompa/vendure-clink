import React, { useState, useEffect, useCallback } from 'react';

export interface ClinkOffer {
  offerId: string;
  noffer: string;
  amountSats: number;
  status: 'pending' | 'paid' | 'expired';
  bolt11Invoice?: string;
  expiresAt?: string;
  relayUrls?: string[];
}

export interface ClinkPaymentStatus {
  offerId: string;
  status: string;
  bolt11Invoice?: string;
  preimage?: string;
  noffer?: string;
  amountSats: number;
}

export interface ClinkPaymentProps {
  orderCode: string;
  apiEndpoint?: string;
  pollIntervalMs?: number;
  onPaymentConfirmed?: (preimage: string) => void;
  onPaymentExpired?: () => void;
  onPaymentError?: (error: string) => void;
  className?: string;
  showRelayInfo?: boolean;
}

export function ClinkPayment({
  orderCode,
  apiEndpoint = 'http://localhost:12345/shop-api',
  pollIntervalMs = 3000,
  onPaymentConfirmed,
  onPaymentExpired,
  onPaymentError,
  className = '',
  showRelayInfo = false,
}: ClinkPaymentProps) {
  const [offer, setOffer] = useState<ClinkOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const fetchOffer = useCallback(async () => {
    try {
      setLoading(true);
      const query = `
        query GetClinkOffer($orderCode: String!) {
          clinkOffer(orderCode: $orderCode) {
            offerId
            noffer
            amountSats
            status
            bolt11Invoice
            expiresAt
            relayUrls
          }
        }
      `;

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { orderCode } }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors?.length) {
        throw new Error(data.errors[0].message);
      }

      if (data.data?.clinkOffer) {
        setOffer(data.data.clinkOffer);
        setError(null);
      } else {
        setError('No CLINK offer found for this order');
        onPaymentError?.('No CLINK offer found');
      }
    } catch (err: any) {
      const msg = `Failed to fetch offer: ${err.message}`;
      setError(msg);
      onPaymentError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [orderCode, apiEndpoint, onPaymentError]);

  const checkPaymentStatus = useCallback(async () => {
    if (!offer || offer.status !== 'pending') return;

    try {
      const query = `
        query GetClinkPaymentStatus($orderCode: String!) {
          clinkPaymentStatus(orderCode: $orderCode) {
            offerId
            status
            bolt11Invoice
            preimage
            noffer
            amountSats
          }
        }
      `;

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { orderCode } }),
      });

      if (!response.ok) return;

      const data = await response.json();
      const status = data.data?.clinkPaymentStatus;

      if (status?.status === 'paid') {
        setOffer(prev => (prev ? { ...prev, status: 'paid' } : null));
        if (status.preimage) {
          onPaymentConfirmed?.(status.preimage);
        }
      } else if (status?.status === 'expired') {
        setOffer(prev => (prev ? { ...prev, status: 'expired' } : null));
        onPaymentExpired?.();
      }
    } catch {
      // Silent — polling shouldn't throw
    }
  }, [offer, orderCode, apiEndpoint, onPaymentConfirmed, onPaymentExpired]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  useEffect(() => {
    if (offer?.status !== 'pending') return;
    const interval = setInterval(checkPaymentStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [offer?.status, checkPaymentStatus, pollIntervalMs]);

  useEffect(() => {
    if (!offer?.expiresAt || offer.status !== 'pending') return;

    const expiresAt = new Date(offer.expiresAt).getTime();
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setOffer(prev => (prev ? { ...prev, status: 'expired' } : null));
        onPaymentExpired?.();
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [offer?.expiresAt, offer?.status, onPaymentExpired]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={`clink-payment loading ${className}`}>
        <p>Loading payment details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`clink-payment error ${className}`}>
        <p className="clink-error-message">{error}</p>
        <button className="clink-retry-btn" onClick={fetchOffer}>
          Retry
        </button>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className={`clink-payment ${className}`}>
        <p>No payment offer available</p>
      </div>
    );
  }

  if (offer.status === 'paid') {
    return (
      <div className={`clink-payment success ${className}`}>
        <div className="clink-checkmark">&#10003;</div>
        <h3>Payment Confirmed!</h3>
        <p>Thank you for your Bitcoin Lightning payment.</p>
      </div>
    );
  }

  if (offer.status === 'expired') {
    return (
      <div className={`clink-payment expired ${className}`}>
        <h3>Payment Expired</h3>
        <p>This payment offer has expired.</p>
        <button className="clink-retry-btn" onClick={fetchOffer}>
          Generate New Offer
        </button>
      </div>
    );
  }

  return (
    <div className={`clink-payment pending ${className}`}>
      <h3>Pay with Bitcoin Lightning</h3>

      <div className="clink-offer-details">
        <p className="clink-amount">{offer.amountSats.toLocaleString()} sats</p>
        {timeLeft > 0 && (
          <p className="clink-timer">Expires in: {formatTime(timeLeft)}</p>
        )}
      </div>

      <div className="clink-noffer-section">
        <p className="clink-label">CLINK Offer:</p>
        <div className="clink-noffer-string">
          <code>{offer.noffer}</code>
          <button
            className="clink-copy-btn"
            onClick={() => copyToClipboard(offer.noffer)}
            aria-label="Copy offer code"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="clink-instructions">
        <p>Open a CLINK-compatible wallet and scan or paste the offer code above.</p>
        <p className="clink-supported-wallets">
          Supported: ShockWallet, ZEUS, and other CLINK-enabled wallets.
        </p>
        {showRelayInfo && offer.relayUrls && offer.relayUrls.length > 0 && (
          <p className="clink-relay-info">
            Connected to: {offer.relayUrls.join(', ')}
          </p>
        )}
      </div>

      <div className="clink-status-check">
        <p>Waiting for payment...</p>
        <div className="clink-pulse" />
      </div>
    </div>
  );
}

export default ClinkPayment;
