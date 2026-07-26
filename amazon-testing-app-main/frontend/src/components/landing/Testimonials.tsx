import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, CheckCircle, ThumbsUp, MessageSquare, Plus, X } from 'lucide-react';
import { Testimonial } from '../../types';

interface TestimonialsProps {
  testimonials: Testimonial[];
  onAddReview: (review: any) => void;
}

export default function Testimonials({ testimonials, onAddReview }: TestimonialsProps) {
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>({});
  const [votedItems, setVotedItems] = useState<Record<string, boolean>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Review Form state
  const [reviewerName, setReviewerName] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewLocation, setReviewLocation] = useState('United States');

  const handleHelpfulClick = (id: string, initialCount: number) => {
    if (votedItems[id]) return; // prevent double voting

    setHelpfulVotes((prev) => ({
      ...prev,
      [id]: (helpfulVotes[id] ?? initialCount) + 1
    }));
    setVotedItems((prev) => ({
      ...prev,
      [id]: true
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerName || !reviewTitle || !reviewContent) return;

    const newReview = {
      id: `custom-test-${Date.now()}`,
      name: reviewerName,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150`, // generic high quality face
      title: reviewTitle,
      rating: reviewRating,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      verified: true,
      location: reviewLocation,
      content: reviewContent,
      helpfulCount: 0
    };

    onAddReview(newReview);
    
    // Reset form
    setReviewerName('');
    setReviewTitle('');
    setReviewContent('');
    setReviewRating(5);
    setIsFormOpen(false);
  };

  return (
    <section id="testimonials" className="py-16 md:py-24 bg-white font-sans border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        
        {/* Header Grid */}
        <div className="text-left space-y-2 mb-16">
          <span className="text-xs font-bold text-amazon-blue uppercase tracking-widest font-mono">Verified Reviewer Feedback</span>
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-amazon-dark tracking-tight">
            Reviewer Testimonials
          </h2>
          <p className="text-sm text-gray-500 max-w-xl">
            Read transparent, helpful, and verified user testimonials regarding completed review campaigns.
          </p>
        </div>

        {/* Amazon-style split reviews structure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Amazon Rating Distribution Graph */}
          <div className="lg:col-span-4 space-y-6 text-left lg:sticky lg:top-24 h-fit">
            <h3 className="text-lg font-bold text-gray-900">Reviewer Ratings</h3>
            
            <div className="flex items-center space-x-3">
              <div className="flex text-amazon-gold">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <span className="text-base font-extrabold text-gray-900">4.8 out of 5 stars</span>
            </div>

            <p className="text-xs text-gray-500 font-medium">17,342 verified campaign submissions</p>

            {/* Distribution chart */}
            <div className="space-y-3 pt-2">
              <RatingRow stars={5} percentage={84} />
              <RatingRow stars={4} percentage={11} />
              <RatingRow stars={3} percentage={3} />
              <RatingRow stars={2} percentage={1} />
              <RatingRow stars={1} percentage={1} />
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900">Share your experience</h4>
              <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
                Share your thoughts on campaign diagnostics, task payout speed, or interface performance.
              </p>
              <button
                onClick={() => setIsFormOpen(true)}
                className="w-full text-center bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-xs font-semibold py-3 rounded-lg shadow-xs transition cursor-pointer"
              >
                Write a panelist testimonial
              </button>
            </div>
          </div>

          {/* Right Column: Individual Customer Review List */}
          <div className="lg:col-span-8 space-y-8 text-left">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Top feedback from verified panelist stream</h3>
            
            <div className="space-y-8">
              {testimonials.map((test) => {
                const currentHelpfulVal = helpfulVotes[test.id] ?? test.helpfulCount;
                const hasVoted = votedItems[test.id];

                return (
                  <motion.div 
                    key={test.id}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.4 }}
                    className="space-y-3 border-b border-gray-100 pb-8 last:border-b-0 last:pb-0"
                  >
                    {/* User profile details */}
                    <div className="flex items-center space-x-3">
                      <img 
                        src={test.avatar} 
                        alt={test.name} 
                        className="h-8 w-8 rounded-full object-cover border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800">{test.name}</p>
                        {test.location && (
                          <p className="text-xxs text-gray-400 font-medium">Panelist based in {test.location}</p>
                        )}
                      </div>
                    </div>

                    {/* Star rating + Title */}
                    <div className="flex items-center space-x-2.5">
                      <div className="flex text-amazon-gold">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-4 w-4 ${i < test.rating ? 'fill-current' : 'text-gray-200'}`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs font-extrabold text-gray-900 leading-none">
                        {test.title}
                      </span>
                    </div>
                    {/* Review content */}
                    <p className="text-xs text-gray-600 font-normal leading-relaxed">
                      {test.content}
                    </p>

                    {/* Helpful vote button interaction */}
                    <div className="flex items-center pt-2">
                      <button
                        onClick={() => handleHelpfulClick(test.id, test.helpfulCount)}
                        className="flex items-center space-x-1.5 text-gray-500 hover:text-amazon-orange transition cursor-pointer text-xs font-semibold"
                      >
                        <ThumbsUp className={`h-4 w-4 ${hasVoted ? 'fill-amazon-orange text-amazon-orange' : 'text-gray-400'}`} />
                        <span>{currentHelpfulVal}</span>
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Review Submission Modal Dialog */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-black"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full z-10 font-sans text-gray-900 border border-gray-200"
            >
              <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-1.5">
                  <MessageSquare className="h-4.5 w-4.5 text-amazon-blue" />
                  <span>Submit Testimonial</span>
                </h3>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-200 transition text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Overall Platform Experience</label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1 text-gray-300 hover:text-amazon-gold transition"
                      >
                        <Star 
                          className={`h-6 w-6 ${
                            star <= reviewRating ? 'text-amazon-gold fill-current' : ''
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Sarah Jenkins"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amazon-gold text-gray-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Review Headline</label>
                  <input
                    type="text"
                    required
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Sound is incredible! Setup was under 30s..."
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amazon-gold text-gray-900 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Your Testimonial Content</label>
                  <textarea
                    required
                    rows={4}
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    placeholder="Describe your experience with campaign allocations, payout speed, or interface performance..."
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amazon-gold text-gray-900 font-normal leading-relaxed"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-amazon-gold hover:bg-[#f3a847] text-amazon-dark text-xs font-bold py-2.5 rounded-lg shadow-sm transition"
                  >
                    Submit Testimonial
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </section>
  );
}

// Distribution progress row sub-component
function RatingRow({ stars, percentage }: { stars: number; percentage: number }) {
  return (
    <div className="flex items-center text-xs text-gray-700 font-semibold space-x-3">
      <span className="w-10 hover:underline hover:text-amazon-blue cursor-pointer">{stars} star</span>
      <div className="flex-1 h-5 bg-gray-100 rounded border border-gray-200 overflow-hidden relative shadow-inner">
        <motion.div 
          initial={{ width: 0 }}
          whileInView={{ width: `${percentage}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute left-0 top-0 bottom-0 bg-amazon-gold rounded"
        />
      </div>
      <span className="w-8 text-right hover:underline hover:text-amazon-blue cursor-pointer">{percentage}%</span>
    </div>
  );
}
