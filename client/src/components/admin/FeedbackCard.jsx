import { RATING_OPTIONS } from '../../utils/feedbackForm.js';

function RatingLabel({ rating }) {
  return RATING_OPTIONS.find((option) => option.value === rating)?.label || `Rating ${rating}`;
}

function FeedbackCard({ item, onDelete }) {
  const ratingText = RATING_OPTIONS.find((option) => option.value === item.rating)?.label || `Rating ${item.rating}`;
  return (
    <article className="feedback-card" aria-labelledby={`feedback-${item.id}`}>
      <div className="feedback-card-top">
        <div className="feedback-author">
          <span className="avatar-initial" aria-hidden="true">{item.name.trim().charAt(0).toUpperCase() || '?'}</span>
          <div><h3 id={`feedback-${item.id}`}>{item.name}</h3><a href={`mailto:${item.email}`}>{item.email}</a></div>
        </div>
        <time dateTime={item.createdAt}>{formatFeedbackDate(item.createdAt)}</time>
      </div>
      <div className="feedback-meta">
        <span className="type-pill">{item.feedbackType}</span>
        <span className="rating-pill" aria-label={`Rating ${item.rating} out of 5, ${ratingText}`}>
          <span aria-hidden="true">★</span> {item.rating}/5 · <RatingLabel rating={item.rating} />
        </span>
      </div>
      <p className="feedback-message">{item.message.length > 320 ? `${item.message.slice(0, 320)}…` : item.message}</p>
      <div className="feedback-card-actions">
        <button className="delete-button" type="button" onClick={() => onDelete(item)} aria-label={`Delete feedback from ${item.name}`}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 6h11m-9.5 0 .6 10h7.8L15 6m-7-2h4l.7 2H7.3L8 4Zm1.5 5v4m2-4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Delete
        </button>
      </div>
    </article>
  );
}

export default FeedbackCard;
