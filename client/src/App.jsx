import { useCallback, useMemo, useRef, useState } from 'react';
import TurnstileWidget from './components/TurnstileWidget.jsx';
import AdminApp from './components/admin/AdminApp.jsx';
import {
  FEEDBACK_TYPES,
  getSuggestedPrompt,
  RATING_OPTIONS,
  validateFeedbackForm,
} from './utils/feedbackForm.js';

const EMPTY_FORM = {
  name: '',
  email: '',
  feedbackType: 'General feedback',
  rating: 0,
  message: '',
};

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

function FaceIcon({ rating, selected }) {
  const mouth = {
    1: 'M8 21 Q14 14 20 21',
    2: 'M9 20 Q14 17 19 20',
    3: 'M9 19 H19',
    4: 'M8 18 Q14 24 20 18',
    5: 'M7 17 Q14 26 21 17',
  }[rating];

  return (
    <svg
      aria-hidden="true"
      className={`face-icon ${selected ? 'face-icon-selected' : ''}`}
      fill="none"
      viewBox="0 0 28 28"
    >
      <circle cx="14" cy="14" r="11.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="11" r="1" fill="currentColor" />
      <circle cx="18" cy="11" r="1" fill="currentColor" />
      <path d={mouth} stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function FieldError({ id, children }) {
  return children ? <p className="field-error" id={id}>{children}</p> : null;
}

function PublicFeedbackPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaCycle, setCaptchaCycle] = useState(0);
  const messageRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const typeRef = useRef(null);
  const ratingRef = useRef(null);
  const errorSummaryRef = useRef(null);
  const prompt = useMemo(
    () => getSuggestedPrompt(form.feedbackType, form.rating),
    [form.feedbackType, form.rating],
  );

  const handleTurnstileToken = useCallback((token) => {
    setTurnstileToken(token);
    if (token) setFieldErrors((current) => ({ ...current, turnstileToken: undefined }));
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'rating' ? Number(value) : value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setNotice(null);
  }

  function handleRatingChange(event) {
    updateField(event);
    setFieldErrors((current) => ({ ...current, rating: undefined }));
  }

  function usePrompt() {
    setForm((current) => ({ ...current, message: prompt }));
    setFieldErrors((current) => ({ ...current, message: undefined }));
    messageRef.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateFeedbackForm(form, turnstileToken);
    setFieldErrors(errors);
    setNotice(null);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
        const firstInvalid = ['name', 'email', 'feedbackType', 'rating', 'message', 'turnstileToken']
          .find((field) => errors[field]);
        ({ name: nameRef, email: emailRef, feedbackType: typeRef, rating: ratingRef, message: messageRef }[firstInvalid])
          ?.current?.focus();
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          message: form.message.trim(),
          turnstileToken,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.errors && typeof result.errors === 'object') {
          setFieldErrors({
            ...result.errors,
            turnstileToken: result.errors.turnstileToken,
          });
        }
        setNotice({
          type: 'error',
          message: result.message || 'Your feedback could not be sent. Please try again.',
        });
        setTurnstileToken('');
        setCaptchaCycle((cycle) => cycle + 1);
        return;
      }

      setForm(EMPTY_FORM);
      setFieldErrors({});
      setTurnstileToken('');
      setCaptchaCycle((cycle) => cycle + 1);
      setNotice({ type: 'success', message: 'Thank you. Your feedback has been received.' });
    } catch {
      setNotice({ type: 'error', message: 'We could not reach the server. Check your connection and try again.' });
      setTurnstileToken('');
      setCaptchaCycle((cycle) => cycle + 1);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Feedback Collector home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>Feedback <span className="brand-muted">Collector</span></span>
        </a>
        <span className="header-note"><span className="header-dot" /> Open feedback</span>
      </header>

      <main id="top" className="main-layout">
        <section className="intro-column" aria-labelledby="page-title">
          <p className="eyebrow"><span className="eyebrow-line" /> YOUR VOICE, IN THE LOOP</p>
          <h1 id="page-title">Help us make the next visit <span>better.</span></h1>
          <p className="intro-copy">
            A useful product is built by listening. Tell us what worked, what didn’t,
            or what you would like to see next.
          </p>

          <div className="process-card">
            <div className="process-heading">
              <span className="process-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.2A2.5 2.5 0 0 1 5 12.5v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 9h6M9 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </span>
              <div>
                <p className="process-title">A few thoughtful details</p>
                <p className="process-subtitle">Your input helps guide what we improve.</p>
              </div>
            </div>
            <ol className="process-list">
              <li><span>01</span><div><strong>Choose a rating</strong><small>Share how the experience felt.</small></div></li>
              <li><span>02</span><div><strong>Add the context</strong><small>A specific example is always helpful.</small></div></li>
              <li><span>03</span><div><strong>Send it our way</strong><small>We’ll use it to make informed improvements.</small></div></li>
            </ol>
          </div>

          <p className="privacy-note">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 16 5v4.2c0 3.8-2.5 6.6-6 8.3-3.5-1.7-6-4.5-6-8.3V5l6-2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="m7.5 9.8 1.7 1.7 3.4-3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Your name and email are stored alongside your feedback.
          </p>
        </section>

        <section className="form-card" aria-labelledby="form-title">
          <div className="form-card-heading">
            <div>
              <p className="form-kicker">FEEDBACK FORM <span>·</span> 2 MIN</p>
              <h2 id="form-title">Tell us about it</h2>
            </div>
            <span className="required-note"><b>*</b> Required</span>
          </div>

          {notice && (
            <div
              className={`notice notice-${notice.type}`}
              role={notice.type === 'error' ? 'alert' : 'status'}
              aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
            >
              <span className="notice-icon" aria-hidden="true">{notice.type === 'success' ? '✓' : '!'}</span>
              <p>{notice.message}</p>
            </div>
          )}

          {Object.keys(fieldErrors).some((field) => fieldErrors[field]) && (
            <div className="error-summary" tabIndex="-1" ref={errorSummaryRef} aria-label="Form errors">
              Please check the highlighted fields below.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <fieldset className="form-fields" disabled={isSubmitting}>
              <legend className="sr-only">Your feedback</legend>
              <div className="form-grid">
                <div className="field-group">
                  <label htmlFor="name">Your name <span>*</span></label>
                  <input
                    ref={nameRef}
                    autoComplete="name"
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="e.g. Alex Morgan"
                    maxLength={200}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                  />
                  <FieldError id="name-error">{fieldErrors.name}</FieldError>
                </div>

                <div className="field-group">
                  <label htmlFor="email">Email address <span>*</span></label>
                  <input
                    ref={emailRef}
                    autoComplete="email"
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="you@example.com"
                    maxLength={255}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  />
                  <FieldError id="email-error">{fieldErrors.email}</FieldError>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="feedbackType">What is this about? <span>*</span></label>
                <div className="select-wrap">
                  <select
                    ref={typeRef}
                    id="feedbackType"
                    name="feedbackType"
                    value={form.feedbackType}
                    onChange={updateField}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.feedbackType)}
                    aria-describedby={fieldErrors.feedbackType ? 'type-error' : undefined}
                  >
                    {FEEDBACK_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <FieldError id="type-error">{fieldErrors.feedbackType}</FieldError>
              </div>

              <fieldset
                ref={ratingRef}
                className="rating-fieldset"
                tabIndex="-1"
                aria-required="true"
                aria-describedby={fieldErrors.rating ? 'rating-hint rating-error' : 'rating-hint'}
                aria-invalid={Boolean(fieldErrors.rating)}
              >
                <legend>How was your experience? <span>*</span></legend>
                <p id="rating-hint" className="field-hint">Select one rating</p>
                <div className="rating-options">
                  {RATING_OPTIONS.map(({ value, label }) => (
                    <label className={`rating-option ${form.rating === value ? 'rating-option-active' : ''}`} key={value}>
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={form.rating === value}
                        onChange={handleRatingChange}
                        required
                        aria-label={`${value}, ${label}`}
                      />
                      <span className="rating-visual"><FaceIcon rating={value} selected={form.rating === value} /></span>
                      <span className="rating-label">{label}</span>
                    </label>
                  ))}
                </div>
                <FieldError id="rating-error">{fieldErrors.rating}</FieldError>
              </fieldset>

              <div className="field-group message-field">
                <div className="message-label-row">
                  <label htmlFor="message">Your message <span>*</span></label>
                  <button className="suggestion-button" type="button" onClick={usePrompt}>
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5v3M10 14.5v3M2.5 10h3m9 0h3m-11.7-5.2 2.1 2.1m6.2 6.2 2.1 2.1m0-10.4-2.1 2.1m-6.2 6.2-2.1 2.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                    Use a prompt
                  </button>
                </div>
                <textarea
                  ref={messageRef}
                  id="message"
                  name="message"
                  rows="4"
                  value={form.message}
                  onChange={updateField}
                  placeholder="Tell us a little more about your experience..."
                  maxLength={2000}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.message)}
                  aria-describedby={fieldErrors.message ? 'message-hint message-error' : 'message-hint'}
                />
                <div className="message-footer">
                  <span id="message-hint" className="field-hint">Your message is editable before you send it.</span>
                  <span className="character-count" aria-live="polite">{Array.from(form.message).length}/1,000</span>
                </div>
                <FieldError id="message-error">{fieldErrors.message}</FieldError>
              </div>

              <div className="captcha-section">
                <p id="captcha-label" className="captcha-label">Quick verification <span>*</span></p>
                <TurnstileWidget
                  key={captchaCycle}
                  siteKey={SITE_KEY}
                  onToken={handleTurnstileToken}
                  error={fieldErrors.turnstileToken}
                />
              </div>
            </fieldset>

            <div className="submit-row">
              <p className="submit-note">Fields marked <span>*</span> are required.</p>
              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><span className="button-spinner" aria-hidden="true" /> Sending...</>
                ) : (
                  <>Send feedback <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 10h13m0 0L11 4.5M16.5 10 11 15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></>
                )}
              </button>
            </div>
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <span>Feedback Collector</span>
        <span>Thoughtful feedback makes a difference.</span>
        <a href="/admin">Administrator sign in</a>
      </footer>
    </div>
  );
}

export default function App() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
    ? <AdminApp />
    : <PublicFeedbackPage />;
}
