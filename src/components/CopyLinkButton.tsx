import { useState } from 'react';
import { LinkIcon } from '@heroicons/react/24/outline';
import { copyTextToClipboard } from '../utils/clipboard';

interface CopyLinkButtonProps {
  eventId: string;
  eventTitle: string;
}

export function CopyLinkButton({ eventId, eventTitle }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      const eventUrl = new URL(`/events/${eventId}`, window.location.origin).href;
      await copyTextToClipboard(eventUrl);
      setStatus('copied');
      window.setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      window.setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const label = status === 'copied'
    ? 'Event link copied'
    : status === 'error'
      ? 'Could not copy event link'
      : `Copy link to ${eventTitle}`;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded p-1 transition-colors"
    >
      <LinkIcon className="w-5 h-5" aria-hidden="true" />
      <span className="sr-only" aria-live="polite">{status === 'copied' ? 'Link copied.' : status === 'error' ? 'Unable to copy link.' : ''}</span>
    </button>
  );
}
