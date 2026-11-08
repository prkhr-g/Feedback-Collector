import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TurnstileWidget from '../components/TurnstileWidget.jsx';
import pentharaLogo from '../assets/penthara-logo.png';
import { FeedbackApiError, submitFeedback } from '../services/feedbackApi.js';
import {
  FEEDBACK_TYPES,
  getFeedbackSuggestions,
  getSuggestionKeyAction,
  RATING_OPTIONS,
  validateFeedbackForm,
} from '../utils/feedbackForm.js';

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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suppressSuggestionFocusRef = useRef(false);
  const messageFieldRef = useRef(null);
  const messageRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const typeRef = useRef(null);
  const ratingRef = useRef(null);
  const errorSummaryRef = useRef(null);
  const successDialogRef = useRef(null);
  const submissionLockRef = useRef(false);
  const suggestions = useMemo(
    () => getFeedbackSuggestions(form.feedbackType, form.rating, form.message),
    [form.feedbackType, form.rating, form.message],
  );

  useEffect(() => {
    if (successOpen && successDialogRef.current && !successDialogRef.current.open) {
      successDialogRef.current.showModal();
    }
  }, [successOpen]);

  function handleSuccessClose() {
    setSuccessOpen(false);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setTurnstileToken('');
    setNotice(null);
    submissionLockRef.current = false;
  }

  useEffect(() => {
    if (!suggestionsOpen) return undefined;
    function closeOnOutsidePointer(event) {
      if (!messageFieldRef.current?.contains(event.target)) {
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [suggestionsOpen]);

  const handleTurnstileToken = useCallback((token) => {
    setTurnstileToken(token);
    if (token) setFieldErrors((current) => ({ ...current, turnstileToken: undefined }));
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'rating' ? Number(value) : value }));
    if (name === 'message' || name === 'feedbackType' || name === 'rating') {
      setActiveSuggestionIndex(-1);
    }
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setNotice(null);
  }

  function handleRatingChange(event) {
    updateField(event);
  }

  function chooseSuggestion(suggestion) {
    setForm((current) => ({ ...current, message: suggestion }));
    setFieldErrors((current) => ({ ...current, message: undefined }));
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    messageRef.current?.focus();
  }

  function handleMessageKeyDown(event) {
    const action = getSuggestionKeyAction(event.key, activeSuggestionIndex, suggestions.length);
    if (!action) return;
    if (action.type === 'close') {
      event.preventDefault();
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
    } else if (action.type === 'move') {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestionIndex(action.index);
    } else if (action.type === 'select') {
      event.preventDefault();
      chooseSuggestion(suggestions[action.index]);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    if (submissionLockRef.current || isSubmitting || successOpen) return;

    const errors = validateFeedbackForm(form, turnstileToken);
    setFieldErrors(errors);
    setNotice(null);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
        const firstInvalid = ['name', 'email', 'feedbackType', 'rating', 'message', 'turnstileToken']
          .find((field) => errors[field]);
        const firstInvalidRef = ({ name: nameRef, email: emailRef, feedbackType: typeRef, rating: ratingRef, message: messageRef }[firstInvalid]);
        if (firstInvalid === 'message') suppressSuggestionFocusRef.current = true;
        firstInvalidRef?.current?.focus();
        suppressSuggestionFocusRef.current = false;
      });
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    let submissionSucceeded = false;
    try {
      await submitFeedback({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        message: form.message.trim(),
        turnstileToken,
      });

      setFieldErrors({});
      setTurnstileToken('');
      setCaptchaCycle((cycle) => cycle + 1);
      setNotice(null);
      submissionSucceeded = true;
      setSuccessOpen(true);
    } catch (error) {
      if (error instanceof FeedbackApiError && Object.keys(error.errors).length > 0) {
        setFieldErrors({
          ...error.errors,
          turnstileToken: error.errors.turnstileToken,
        });
      }
      setNotice({
        type: 'error',
        message: error.message || 'Your feedback could not be sent. Please try again.',
      });
      setTurnstileToken('');
      setCaptchaCycle((cycle) => cycle + 1);
    } finally {
      setIsSubmitting(false);
      if (!submissionSucceeded) submissionLockRef.current = false;
    }
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Penthara Technologies feedback portal home">
          <img className="brand-mark" src={pentharaLogo} alt="" aria-hidden="true" />
          <span className="brand-lockup"><strong>Penthara Technologies</strong><small>FEEDBACK PORTAL</small></span>
        </a>
        <div className="header-actions">
          <span className="header-note"><span className="header-dot" /> Open feedback</span>
          <a className="admin-signin-link" href="/admin">Admin sign in</a>
        </div>
      </header>

      <main id="top" className="main-layout">
        <section className="intro-column" aria-labelledby="page-title">
          <p className="eyebrow"><span className="eyebrow-line" /> YOUR VOICE, IN THE LOOP</p>
          <h1 id="page-title">Help us make the next visit <span>better.</span></h1>
          <p className="intro-copy">
            Tell us about your experience with Penthara Technologies. Share what
            worked, what could improve, or what you would like to see next.
          </p>

          <section className="feedback-preview" aria-labelledby="preview-title">
            <div className="preview-header">
              <div>
                <h2 className="preview-title" id="preview-title">Your feedback preview</h2>
                <span className="preview-type">{form.feedbackType || 'Feedback type'}</span>
              </div>
              <span className="preview-live"><span className="preview-live-dot" /> Live preview</span>
            </div>
            <div className="preview-rating" aria-label={form.rating ? `Rating ${form.rating} out of 5, ${RATING_OPTIONS.find(({ value }) => value === form.rating)?.label}` : 'No rating selected'}>
              {form.rating ? (
                <>
                  <span className="preview-face"><FaceIcon rating={form.rating} selected /></span>
                  <span className="preview-rating-copy">
                    <strong>{RATING_OPTIONS.find(({ value }) => value === form.rating)?.label}</strong>
                    <small>{form.rating} out of 5</small>
                  </span>
                  <span className="preview-stars" aria-hidden="true">
                    {RATING_OPTIONS.map(({ value }) => <span className={value <= form.rating ? 'preview-star-active' : ''} key={value}>&#9733;</span>)}
                  </span>
                </>
              ) : <span className="preview-rating-empty">No rating selected yet</span>}
            </div>
            <p className={`preview-message ${form.message.trim() ? '' : 'preview-message-placeholder'}`}>
              {form.message.trim() ? form.message : 'Your message will appear here as you write.'}
            </p>
          </section>

          <p className="privacy-note">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 16 5v4.2c0 3.8-2.5 6.6-6 8.3-3.5-1.7-6-4.5-6-8.3V5l6-2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="m7.5 9.8 1.7 1.7 3.4-3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Your name and email are stored alongside your feedback.
          </p>
        </section>

        <section className="form-card" aria-labelledby="form-title">
          <div className="form-card-heading">
            <p className="form-kicker" id="form-title">FEEDBACK FORM</p>
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

              <div className="field-group message-field" ref={messageFieldRef}>
                <div className="message-label-row">
                  <label htmlFor="message">Your message <span>*</span></label>
                  <span className="suggestion-label">Optional suggestions</span>
                </div>
                {suggestionsOpen && (
                  <div className="suggestion-panel">
                    <div className="suggestion-panel-heading">
                      <span>Suggestions</span>
                      <span>{form.feedbackType} · {form.rating ? RATING_OPTIONS.find(({ value }) => value === form.rating)?.label : 'all ratings'}</span>
                    </div>
                    <ul id="message-suggestions" className="suggestion-list" role="listbox" aria-label="Prewritten feedback suggestions">
                      {suggestions.length > 0 ? suggestions.map((suggestion, index) => (
                        <li
                          id={`message-suggestion-${index}`}
                          className={`suggestion-option ${activeSuggestionIndex === index ? 'suggestion-option-active' : ''}`}
                          key={suggestion}
                          role="option"
                          aria-selected={activeSuggestionIndex === index}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => chooseSuggestion(suggestion)}
                        >
                          {suggestion}
                        </li>
                      )) : (
                        <li className="suggestion-empty" role="option" aria-disabled="true">No matching suggestions. You can keep writing your own feedback.</li>
                      )}
                    </ul>
                  </div>
                )}
                <textarea
                  ref={messageRef}
                  id="message"
                  name="message"
                  rows="4"
                  value={form.message}
                  onChange={updateField}
                  onFocus={() => {
                    if (suppressSuggestionFocusRef.current) return;
                    setSuggestionsOpen(true);
                    setActiveSuggestionIndex(-1);
                  }}
                  onClick={() => setSuggestionsOpen(true)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder="Tell us a little more about your experience..."
                  maxLength={2000}
                  required
                  aria-required="true"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen}
                  aria-controls={suggestionsOpen ? 'message-suggestions' : undefined}
                  aria-activedescendant={suggestionsOpen && activeSuggestionIndex >= 0 ? `message-suggestion-${activeSuggestionIndex}` : undefined}
                  aria-invalid={Boolean(fieldErrors.message)}
                  aria-describedby={fieldErrors.message ? 'message-hint message-error' : 'message-hint'}
                />
                <div className="message-footer">
                  <span id="message-hint" className="field-hint">Suggestions are optional; your message stays editable.</span>
                  <span className="character-count" aria-live="polite">{Array.from(form.message).length}/1,000</span>
                </div>
                <FieldError id="message-error">{fieldErrors.message}</FieldError>
              </div>

              <div className="verification-submit-group">
                <p id="captcha-label" className="captcha-label">Quick verification <span>*</span></p>
                <div className="verification-submit-row">
                  <div className="captcha-section">
                  <TurnstileWidget
                    key={captchaCycle}
                    siteKey={SITE_KEY}
                    onToken={handleTurnstileToken}
                    error={fieldErrors.turnstileToken}
                  />
                  </div>
                  <button className="submit-button" type="submit" disabled={isSubmitting || successOpen}>
                    {isSubmitting ? (
                      <><span className="button-spinner" aria-hidden="true" /> Sending...</>
                    ) : (
                      <>Send feedback <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 10h13m0 0L11 4.5M16.5 10 11 15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></>
                    )}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <span>Penthara Technologies · Feedback Portal</span>
        <span>Thoughtful feedback makes a difference.</span>
      </footer>

      <dialog
        ref={successDialogRef}
        className="success-dialog"
        aria-labelledby="success-title"
        aria-describedby="success-message"
        onClose={handleSuccessClose}
      >
        <div className="success-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none"><circle className="success-mark-circle" cx="32" cy="32" r="27" /><path className="success-mark-check" d="m19 33 9 9 18-20" /></svg>
        </div>
        <h2 id="success-title">Thank you for your feedback!</h2>
        <p id="success-message">Your feedback has been submitted successfully.</p>
        <button className="success-done-button" type="button" onClick={() => successDialogRef.current?.close()}>Done</button>
      </dialog>
    </div>
  );
}


export default PublicFeedbackPage;
