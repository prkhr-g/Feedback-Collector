import { useEffect, useRef, useState } from 'react';

let turnstileLoadPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoadPromise) {
    turnstileLoadPromise = new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-turnstile-api]');
      const timeoutId = window.setTimeout(() => {
        script?.remove();
        reject(new Error('Verification service timed out.'));
      }, 12000);
      const loaded = () => {
        window.clearTimeout(timeoutId);
        if (window.turnstile) resolve(window.turnstile);
        else {
          script?.remove();
          reject(new Error('Verification widget failed to initialize.'));
        }
      };
      const failed = () => {
        window.clearTimeout(timeoutId);
        script?.remove();
        reject(new Error('Verification service could not be loaded.'));
      };
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.turnstileApi = 'true';
      }
      script.addEventListener('load', loaded, { once: true });
      script.addEventListener('error', failed, { once: true });
      if (!script.isConnected) document.head.appendChild(script);
    }).catch((error) => {
      turnstileLoadPromise = undefined;
      throw error;
    });
  }
  return turnstileLoadPromise;
}

/** Render Cloudflare Turnstile and report its short-lived token to the form. */
export default function TurnstileWidget({ siteKey, onToken, error }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(siteKey));
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!siteKey) {
      setIsLoading(false);
      return undefined;
    }
    let active = true;
    setIsLoading(true);
    loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('');
            setLoadError('Verification could not be completed. Check your connection and try again.');
            return true;
          },
        });
        setLoadError('');
        setIsLoading(false);
      })
      .catch(() => {
        if (active) {
          setIsLoading(false);
          setLoadError('Verification could not be loaded. Check your connection and retry.');
        }
      });

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken, retryCount]);

  const reset = () => {
    setLoadError('');
    setRetryCount((count) => count + 1);
  };

  return (
    <div
      className="captcha-panel"
      role="group"
      aria-labelledby="captcha-label"
      aria-describedby={error ? 'turnstile-error' : undefined}
    >
      {siteKey ? (
        <>
          <div ref={containerRef} />
          {isLoading && <p className="captcha-message" role="status">Loading verification…</p>}
        </>
      ) : (
        <p className="captcha-message">Verification is not configured. Set the public site key in <code>client/.env.local</code>.</p>
      )}
      {loadError && (
        <div className="captcha-feedback" role="status">
          <span>{loadError}</span>
          <button className="text-button" type="button" onClick={reset}>Retry</button>
        </div>
      )}
      {error && <p className="field-error" id="turnstile-error">{error}</p>}
    </div>
  );
}
