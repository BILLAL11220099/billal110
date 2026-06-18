/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { NewsFeedPost, NewsFeedComment, UserSession, VideoMetadata } from "../types";
import {
  MessageSquare, ThumbsUp, Send, Image as ImageIcon, Trash2, Edit3,
  X, CheckSquare, Sparkles, HelpCircle, Save, Megaphone, ZoomIn, ZoomOut, RotateCcw,
  Search, User, FileText, Video
} from "lucide-react";
import SecurityModal from "./SecurityModal";

interface NewsFeedPanelProps {
  feed: NewsFeedPost[];
  currentSession: UserSession;
  onSave: (feedList: NewsFeedPost[]) => void;
  activeSelectedFeedPost?: NewsFeedPost | null;
  onOpenVideoHub?: () => void;
  videosCount?: number;
  videos?: VideoMetadata[];
  onSaveVideos?: (videos: VideoMetadata[]) => void;
}

export default function NewsFeedPanel({
  feed,
  currentSession,
  onSave,
  activeSelectedFeedPost,
  onOpenVideoHub,
  videosCount = 0,
  videos = [],
  onSaveVideos = () => {}
}: NewsFeedPanelProps) {
  // Listen for search-linked selected feed post
  React.useEffect(() => {
    if (activeSelectedFeedPost) {
      setSearchInputValue("");
      setCommittedQuery("");
      setTimeout(() => {
        const element = document.getElementById(`feed-card-${activeSelectedFeedPost.id}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-4", "ring-[#FFC72C]", "ring-offset-2", "transition-all", "duration-500");
          setTimeout(() => {
            element.classList.remove("ring-4", "ring-[#FFC72C]", "ring-offset-2");
          }, 3000);
        }
      }, 100);
    }
  }, [activeSelectedFeedPost]);

  // Input & Advanced suggestions states
  const [searchInputValue, setSearchInputValue] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState<string | undefined>(undefined);
  const [newPostImageName, setNewPostImageName] = useState("");

  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const analyzeUploadedImage = async (base64Image: string) => {
    setIsAnalyzingImage(true);
    setAnalysisError(null);
    try {
      const response = await fetch("/api/gemini/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });
      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.title) {
        setNewPostImageName(data.title);
      }
      if (data.description) {
        setNewPostText(prev => {
          if (prev.trim()) {
            return prev + "\n\n--- AI Analysis of Photo ---\n" + data.description;
          }
          return data.description;
        });
      }
    } catch (err: any) {
      console.warn("Failed to auto-analyze photo using Gemini:", err);
      setAnalysisError("AI analysis skipped or offline. You can still type details manually.");
    } finally {
      setIsAnalyzingImage(false);
    }
  };
  
  // Comment states
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

  // Editing states (Each post is editable)
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [editPostImage, setEditPostImage] = useState<string | undefined>(undefined);
  const [editPostImageName, setEditPostImageName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Security Modal States
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityModalTitle, setSecurityModalTitle] = useState("");
  const [securityModalMessage, setSecurityModalMessage] = useState("");
  const [securityModalRequirePin, setSecurityModalRequirePin] = useState(false);
  const [securityModalOnConfirm, setSecurityModalOnConfirm] = useState<(() => void) | null>(null);

  // Full-screen Image viewer & zoom states
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; caption?: string } | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [zoomPosition, setZoomPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Zoom / pan handlers for full-screen viewer
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 0.15;
    let nextScale = zoomScale + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
    nextScale = Math.min(Math.max(nextScale, 0.5), 10); // scale bounds: 50% to 1000%
    setZoomScale(nextScale);
    if (nextScale === 1) {
      setZoomPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoomPosition.x, y: e.clientY - zoomPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setZoomPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleZoomIn = () => {
    setZoomScale(prev => Math.min(prev + 0.25, 10));
  };

  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next === 1) setZoomPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const requestConfirmation = (
    title: string,
    message: string,
    requirePin: boolean,
    onConfirm: () => void
  ) => {
    setSecurityModalTitle(title);
    setSecurityModalMessage(message);
    setSecurityModalRequirePin(requirePin);
    setSecurityModalOnConfirm(() => () => {
      onConfirm();
      setSecurityModalOpen(false);
    });
    setSecurityModalOpen(true);
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() && !newPostImage) return;

    const newPost: NewsFeedPost = {
      id: "feed_" + Date.now(),
      author: currentSession.username,
      role: currentSession.role,
      text: newPostText.trim(),
      image: newPostImage,
      imageName: newPostImage ? newPostImageName.trim() : undefined,
      likes: 0,
      likedBy: [],
      comments: [],
      timestamp: new Date().toISOString()
    };

    onSave([newPost, ...feed]);
    setNewPostText("");
    setNewPostImage(undefined);
    setNewPostImageName("");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const rawBase64 = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200; // 1200px is excellent for high quality and small size
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG with 0.82 quality which gives incredible clarity at sub-200kB sizes
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.82);
          if (isEdit) {
            setEditPostImage(compressedBase64);
          } else {
            setNewPostImage(compressedBase64);
            analyzeUploadedImage(compressedBase64);
          }
        } else {
          // Fallback if canvas is not supported
          if (isEdit) {
            setEditPostImage(rawBase64);
          } else {
            setNewPostImage(rawBase64);
            analyzeUploadedImage(rawBase64);
          }
        }
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  const handleLikePost = (postId: string) => {
    const updated = feed.map(post => {
      if (post.id === postId) {
        const hasLiked = post.likedBy?.includes(currentSession.username) || false;
        let likedBy = post.likedBy || [];
        let likes = post.likes || 0;

        if (hasLiked) {
          likedBy = likedBy.filter(u => u !== currentSession.username);
          likes = Math.max(0, likes - 1);
        } else {
          likedBy = [...likedBy, currentSession.username];
          likes = likes + 1;
        }

        return { ...post, likes, likedBy };
      }
      return post;
    });
    onSave(updated);
  };

  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const updated = feed.map(post => {
      if (post.id === postId) {
        const newComment: NewsFeedComment = {
          id: "cmt_" + Date.now(),
          author: currentSession.username,
          role: currentSession.role,
          text: text,
          timestamp: new Date().toISOString()
        };
        return {
          ...post,
          comments: [...(post.comments || []), newComment]
        };
      }
      return post;
    });

    onSave(updated);
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
  };

  const handleDeletePost = (postId: string) => {
    requestConfirmation(
      "Confirm Notice Deletion",
      "Are you sure you want to delete this shift notice announcement? This action requires management operational PIN validation.",
      true, // requirePin = true!
      () => {
        const updated = feed.filter(p => p.id !== postId);
        onSave(updated);
      }
    );
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    requestConfirmation(
      "Remove Comment",
      "Are you sure you want to remove this comment feedback from this shift announcement?",
      false, // requirePin = false
      () => {
        const updated = feed.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments: (post.comments || []).filter(c => c.id !== commentId)
            };
          }
          return post;
        });
        onSave(updated);
      }
    );
  };

  const startEditingPost = (post: NewsFeedPost) => {
    setEditingPostId(post.id);
    setEditPostText(post.text);
    setEditPostImage(post.image);
    setEditPostImageName(post.imageName || "");
  };

  const saveEditedPost = (postId: string) => {
    if (!editPostText.trim() && !editPostImage) return;

    const updated = feed.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          text: editPostText.trim(),
          image: editPostImage,
          imageName: editPostImage ? editPostImageName.trim() : undefined
        };
      }
      return p;
    });

    onSave(updated);
    setEditingPostId(null);
  };

  // Helper Avatar Color Palette
  const getAvatarColors = (role: string) => {
    switch (role) {
      case "Business Manager": return "bg-rose-50 border-rose-200 text-rose-700";
      case "Kitchen Leader": return "bg-emerald-50 border-emerald-200 text-emerald-700";
      case "Trainer": return "bg-blue-50 border-blue-200 text-blue-700";
      default: return "bg-[#FFC72C]/20 border-[#FFC72C]/50 text-[#8B6E00]";
    }
  };

  // Generate high-quality recommendations/suggestions based on typed input
  const getSuggestions = () => {
    const q = searchInputValue.trim().toLowerCase();
    if (!q) return [];

    const suggestions: { label: string; value: string; snippet?: string; category: "author" | "text" | "photo" | "comment" }[] = [];
    const addedValues = new Set<string>();

    // 1. Match Authors
    const authors = Array.from(new Set(feed.map(p => p.author)));
    authors.forEach(author => {
      if (author.toLowerCase().includes(q)) {
        const key = `author:${author.toLowerCase()}`;
        if (!addedValues.has(key)) {
          addedValues.add(key);
          suggestions.push({
            label: author,
            value: author,
            snippet: "Author in feed updates",
            category: "author"
          });
        }
      }
    });

    // 2. Match Photo Names
    feed.forEach(p => {
      if (p.imageName && p.imageName.toLowerCase().includes(q)) {
        const key = `photo:${p.imageName.toLowerCase()}`;
        if (!addedValues.has(key)) {
          addedValues.add(key);
          suggestions.push({
            label: p.imageName,
            value: p.imageName,
            snippet: "Attached file / photo",
            category: "photo"
          });
        }
      }
    });

    // 3. Match comments
    feed.forEach(p => {
      p.comments?.forEach(c => {
        if (c.text.toLowerCase().includes(q)) {
          const value = c.text.length > 45 ? c.text.slice(0, 45) + "..." : c.text;
          const key = `comment:${value.toLowerCase()}`;
          if (!addedValues.has(key)) {
            addedValues.add(key);
            suggestions.push({
              label: value,
              value: c.text,
              snippet: `Comment by ${c.author}`,
              category: "comment"
            });
          }
        }
      });
    });

    // 4. Match key phrases or words in feed post text
    feed.forEach(p => {
      if (p.text.toLowerCase().includes(q)) {
        const words = p.text.split(/\s+/);
        const matchWord = words.find(w => {
          const cleaned = w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
          return cleaned.startsWith(q) && cleaned.length >= q.length;
        });
        
        if (matchWord) {
          const cleanedWord = matchWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
          const key = `word:${cleanedWord.toLowerCase()}`;
          if (!addedValues.has(key) && cleanedWord.length > 2) {
            addedValues.add(key);
            suggestions.push({
              label: cleanedWord,
              value: cleanedWord,
              snippet: `Matches keyword in post`,
              category: "text"
            });
          }
        }

        const fullPostVal = p.text.length > 45 ? p.text.slice(0, 45) + "..." : p.text;
        const keyFull = `post:${fullPostVal.toLowerCase()}`;
        if (!addedValues.has(keyFull)) {
          addedValues.add(keyFull);
          suggestions.push({
            label: fullPostVal,
            value: p.text,
            snippet: `Excerpt from ${p.author}'s post`,
            category: "text"
          });
        }
      }
    });

    return suggestions.slice(0, 6);
  };

  const activeSuggestions = getSuggestions();

  const filteredFeed = feed.filter((post) => {
    if (!committedQuery.trim()) return true;
    const q = committedQuery.trim().toLowerCase();
    const textMatch = post.text.toLowerCase().includes(q);
    const authorMatch = post.author.toLowerCase().includes(q);
    const roleMatch = post.role.toLowerCase().includes(q);
    const imageNameMatch = post.imageName?.toLowerCase().includes(q) || false;
    const commentsMatch = post.comments?.some(cmt => 
      cmt.text.toLowerCase().includes(q) || 
      cmt.author.toLowerCase().includes(q) || 
      cmt.role.toLowerCase().includes(q)
    ) || false;
    return textMatch || authorMatch || roleMatch || imageNameMatch || commentsMatch;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4 font-sans">
      
      {/* SECTION HEADER */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Megaphone className="w-4.5 h-4.5 text-[#DA291C]" />
            Crew Announcements &amp; News Feed
          </h2>
          <p className="text-slate-400 text-[10px] sm:text-xs">
            Share live feedback, shift greetings, and directly capture restaurant photos to broadcast.
          </p>
        </div>
      </div>

      {/* DEDICATED NEWS FEED ONLY SEARCH BAR */}
      <div id="news-feed-local-search-container" className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 relative">
        <div className="flex items-center justify-between">
          <label htmlFor="feed-local-search" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 select-none">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            Search In News Feed Only
          </label>
          {committedQuery.trim() && (
            <span className="text-[10px] font-mono bg-[#DA291C]/10 text-[#DA291C] px-2 py-0.5 rounded-full font-bold">
              Active Filter: {filteredFeed.length} {filteredFeed.length === 1 ? 'result' : 'results'}
            </span>
          )}
        </div>
        
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="feed-local-search"
                type="text"
                value={searchInputValue}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setCommittedQuery(searchInputValue);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onChange={(e) => {
                  setSearchInputValue(e.target.value);
                  if (!e.target.value) {
                    setCommittedQuery("");
                  }
                }}
                placeholder="Type keywords and hit Enter to search (e.g. author name, comments, checklist)..."
                className="w-full bg-white border border-slate-200 text-slate-850 text-xs rounded-xl pl-9 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-[#FFC72C]/30 focus:border-[#FFC72C] transition-all hover:border-slate-300"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 select-none">
                <Search className="w-3.5 h-3.5" />
              </div>
              {searchInputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInputValue("");
                    setCommittedQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setCommittedQuery(searchInputValue);
              }}
              className="px-4 py-2.5 text-xs font-bold text-white bg-[#DA291C] hover:bg-[#b5220c] rounded-xl hover:shadow-xs active:scale-95 transition-all outline-none"
            >
              Search
            </button>
          </div>
        </div>

        {/* FEEDBACK HELPER LINE */}
        {committedQuery.trim() ? (
          <div className="text-[10.5px] text-slate-500 flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2 mt-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate">
                Showing posts matching: <strong className="text-slate-800">"{committedQuery}"</strong>
              </span>
            </div>
            <button 
              type="button"
              onClick={() => {
                setSearchInputValue("");
                setCommittedQuery("");
              }} 
              className="text-[#DA291C] font-bold hover:underline cursor-pointer text-[10px] uppercase tracking-wider shrink-0"
            >
              Show All Updates
            </button>
          </div>
        ) : (
          searchInputValue.trim() && (
            <div className="text-[10px] text-slate-400/90 font-medium italic pl-1 flex items-center gap-1 mt-1 select-none">
              <Sparkles className="w-3 h-3 text-[#FFC72C]" />
              Press <span className="font-bold font-mono bg-slate-200/50 text-slate-600 px-1 py-0.2 rounded">Enter</span> or click search to apply current filter words.
            </div>
          )
        )}
      </div>

      {/* CREATE POST CARD - FACEBOOK BOX STYLE */}
      {!committedQuery.trim() && (
        <form onSubmit={handleCreatePost} className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            {/* Avatar */}
            <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 border ${getAvatarColors(currentSession.role)}`}>
              {currentSession.username.slice(0, 2).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              {/* Input */}
              <textarea
                id="newsfeed-post-text-input"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                rows={2}
                placeholder={`What is on your mind, ${currentSession.username.split(" ")[0]}? Post shift updates...`}
                className="w-full bg-transparent border-0 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:ring-0 resize-none font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* Thumbnail preview if direct photo loaded */}
          {newPostImage && (
            <div className="space-y-2.5 pt-1">
              <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-1.5 inline-block group">
                <img
                  src={newPostImage}
                  alt="Base64 Upload Preview"
                  className="max-h-48 rounded-lg w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewPostImage(undefined);
                    setNewPostImageName("");
                  }}
                  className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-805 rounded-full p-1 text-white border border-transparent cursor-pointer"
                  id="clear-post-image-btn"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {isAnalyzingImage && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 animate-pulse">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Scanning image details with Gemini AI... Please wait.</span>
                </div>
              )}

              {analysisError && (
                <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <span>{analysisError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <label htmlFor="new-post-image-name" className="block text-[10px] font-bold text-[#DA291C] uppercase tracking-wider mb-1">
                  Name of the Photo (Printed on Feed Graphic)
                </label>
                <input
                  type="text"
                  required
                  id="new-post-image-name"
                  value={newPostImageName}
                  onChange={(e) => setNewPostImageName(e.target.value)}
                  placeholder={isAnalyzingImage ? "Gemini AI is analyzing name..." : "Type the exact name/label as you see in the photo..."}
                  className="w-full bg-white border border-slate-250/90 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 placeholder-slate-400 focus:outline-none focus:border-[#DA291C]"
                  disabled={isAnalyzingImage}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            {/* File Upload Selector Action */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 hover:bg-slate-50 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-[#DA291C] transition-colors cursor-pointer select-none border border-slate-201/20"
              id="post-picture-upload-trigger"
            >
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              Add Shift Photo
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, false)}
              className="hidden"
              id="picture-upload-input"
            />

            <button
              type="submit"
              id="newsfeed-publish-btn"
              className="bg-[#DA291C] hover:bg-[#C21B10] text-[#FFFFFF] font-extrabold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              Publish Post
            </button>
          </div>
        </form>
      )}

      {/* FEED POSTS TIMELINE */}
      <div className="space-y-3">
        {committedQuery.trim() && (
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/60 rounded-xl border border-slate-200/50 mt-1 select-none">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#DA291C] rounded-full animate-ping"></span>
              Search Results ({filteredFeed.length} found)
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchInputValue("");
                setCommittedQuery("");
              }}
              className="text-xs font-extrabold text-[#DA291C] hover:underline cursor-pointer"
            >
              Close Results
            </button>
          </div>
        )}
        {feed.length === 0 ? (
          <div className="p-10 text-center rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
            <p className="text-xs font-bold text-slate-700">Your Operations feed is currently silent.</p>
            <p className="text-[11px] text-slate-400">Be the first to post any shift updates or capture checklist photos!</p>
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
            <p className="text-xs font-bold text-slate-700">No matching posts found.</p>
            <p className="text-[11px] text-slate-400 font-mono text-slate-400">No feed items matched your filter query. Try checking your search spelling.</p>
            <button
              onClick={() => {
                setSearchInputValue("");
                setCommittedQuery("");
              }}
              className="mt-2 text-xs font-bold text-[#DA291C] hover:underline cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95 transition-all text-[11px]"
            >
              Clear News Feed Search
            </button>
          </div>
        ) : committedQuery.trim() ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredFeed.map((post) => {
              return (
                <div 
                  key={post.id} 
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition-all flex flex-col h-full hover:-translate-y-0.5"
                >
                  {post.image ? (
                    /* WITH PHOTO SIMPLIFIED VIEW */
                    <div className="flex flex-col flex-1">
                      <div className="relative bg-slate-50 border-b border-slate-100 flex-1 flex items-center justify-center p-2 min-h-[160px] max-h-[220px] overflow-hidden group">
                        <img
                          src={post.image}
                          alt={post.imageName || "Matched Photo"}
                          onClick={() => {
                            setFullscreenImage({ src: post.image, caption: post.imageName });
                            setZoomScale(1);
                            setZoomPosition({ x: 0, y: 0 });
                          }}
                          className="max-h-full max-w-full object-contain rounded-lg cursor-zoom-in hover:scale-[1.02] transition-transform duration-150"
                          referrerPolicy="no-referrer"
                        />
                        
                        {post.imageName && (
                          <div className="absolute bottom-2 left-2 right-2 bg-slate-900/85 backdrop-blur-xs text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold truncate flex items-center gap-1.5 shadow-sm border border-slate-750">
                            <span className="text-[#DA291C]">📷</span> 
                            <span className="truncate">NAME: {post.imageName}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3.5 space-y-2 flex flex-col justify-between">
                        <p className="text-xs text-slate-705 font-medium line-clamp-2 leading-relaxed">
                          {post.text || <span className="text-slate-400 italic">No text description</span>}
                        </p>
                        <div className="pt-2 border-t border-slate-105 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="truncate font-semibold text-slate-600">By {post.author}</span>
                          <span className="text-slate-400 shrink-0 font-mono">
                            {new Date(post.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCommentPostId(post.id);
                            setCommittedQuery("");
                            setSearchInputValue("");
                            setTimeout(() => {
                              const el = document.getElementById(`feed-card-${post.id}`);
                              el?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 200);
                          }}
                          className="mt-1 w-full text-center text-[10.5px] font-extrabold text-[#DA291C] bg-[#DA291C]/5 hover:bg-[#DA291C]/15 py-2 rounded-xl transition-colors cursor-pointer"
                        >
                          View Live Post &amp; Comments
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* TEXT ONLY SIMPLIFIED VIEW */
                    <div className="p-4 flex flex-col justify-between h-full flex-1">
                      <div className="space-y-1.5 flex-1 pb-3">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 font-mono block">Text Update</span>
                        <p className="text-xs text-slate-705 leading-relaxed line-clamp-4">
                          {post.text}
                        </p>
                      </div>
                      <div className="space-y-2 pt-2.5 mt-auto border-t border-slate-105">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="truncate font-semibold text-slate-600">By {post.author}</span>
                          <span className="text-slate-400 font-mono">
                            {new Date(post.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCommentPostId(post.id);
                            setCommittedQuery("");
                            setSearchInputValue("");
                            setTimeout(() => {
                              const el = document.getElementById(`feed-card-${post.id}`);
                              el?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 200);
                          }}
                          className="w-full text-center text-[10.5px] font-extrabold text-[#DA291C] bg-[#DA291C]/5 hover:bg-[#DA291C]/15 py-2 rounded-xl transition-colors cursor-pointer"
                        >
                          View Live Post &amp; Comments
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          filteredFeed.map((post) => {
            const hasLiked = post.likedBy?.includes(currentSession.username) || false;
            const isEditingThisPost = editingPostId === post.id;
            const commentsList = post.comments || [];

            return (
              <div
                key={post.id}
                className="bg-white border border-slate-200/95 rounded-2xl shadow-3xs overflow-hidden p-4 space-y-3 font-sans"
                id={`feed-card-${post.id}`}
              >
                {/* Header (Author, Role, time) */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center font-extrabold text-xs border shrink-0 ${getAvatarColors(post.role)}`}>
                      {post.author.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">{post.author}</span>
                        <span className="text-[8px] px-1.5 py-0.2 rounded font-bold uppercase bg-slate-50 border border-slate-200 text-slate-600">
                          {post.role}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono tracking-tight block">
                        {new Date(post.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>

                  {/* Allow Delete / Edit if same user or Business Manager */}
                  <div className="flex items-center gap-1">
                    {(post.author === currentSession.username || currentSession.role === "Business Manager") && (
                      <>
                        <button
                          onClick={() => startEditingPost(post)}
                          className="text-slate-400 hover:text-[#DA291C] p-1 rounded hover:bg-slate-55 transition-colors cursor-pointer"
                          title="Edit this post text"
                          id={`post-edit-trigger-${post.id}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-slate-400 hover:text-[#DA291C] p-1 rounded hover:bg-slate-55 transition-colors cursor-pointer"
                          title="Delete this post"
                          id={`post-delete-trigger-${post.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditingThisPost ? (
                  /* POST EDITOR VIEW */
                  <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <textarea
                      id={`edit-feed-input-${post.id}`}
                      value={editPostText}
                      onChange={(e) => setEditPostText(e.target.value)}
                      rows={3}
                      className="w-full bg-transparent border-0 text-xs text-slate-800 focus:outline-none focus:ring-0 resize-none font-sans"
                    />

                    {editPostImage && (
                      <div className="space-y-2">
                        <div className="relative inline-block border border-slate-200 bg-white rounded p-1">
                          <img
                            src={editPostImage}
                            alt="Edit Upload"
                            className="max-h-36 rounded"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditPostImage(undefined);
                              setEditPostImageName("");
                            }}
                            className="absolute top-1.5 right-1.5 bg-slate-900 rounded-full p-1 text-white hover:bg-slate-800 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Name of the Photo (Printed on Graphic)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Type the name as seen in the photo..."
                            value={editPostImageName}
                            onChange={(e) => setEditPostImageName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="text-[10px] text-[#DA291C] font-extrabold cursor-pointer"
                      >
                        Change Photo
                      </button>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, true)}
                        className="hidden"
                      />

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingPostId(null)}
                          className="bg-slate-200 text-slate-700 text-[10px] px-2.5 py-1 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          id="save-edited-post-btn"
                          onClick={() => saveEditedPost(post.id)}
                          className="bg-[#DA291C] text-white text-[10px] font-bold px-3.5 py-1 rounded-lg cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* POST RENDER VIEW */
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-750 leading-relaxed whitespace-pre-wrap font-sans">
                      {post.text}
                    </p>

                    {post.image && (
                      <div className="max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex flex-col relative shadow-3xs" id={`feed-image-card-${post.id}`}>
                        {post.imageName && (
                          <div className="bg-[#DA291C]/5 border-b border-slate-150 py-1.5 px-3 text-center flex items-center justify-center gap-1">
                            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider text-[#DA291C] bg-[#DA291C]/10 px-2.5 py-0.5 rounded-full">
                              📷 NAME SEEN IN PHOTO: {post.imageName}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-center p-1.5 bg-white">
                          <img
                            src={post.image}
                            alt={post.imageName || "Feed Graphic"}
                            onClick={() => {
                              setFullscreenImage({ src: post.image, caption: post.imageName });
                              setZoomScale(1);
                              setZoomPosition({ x: 0, y: 0 });
                            }}
                            className="max-h-[350px] w-auto object-contain rounded-lg cursor-zoom-in hover:brightness-95 transition-all duration-150"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Likes/Comments statistics bar */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-b border-slate-100 py-1.5">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="w-3.5 h-3.5 text-[#FFC72C] fill-[#FFC72C]" />
                    <span className="font-bold text-slate-600">{post.likes} Likes</span>
                  </div>
                  <button
                    onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                    className="hover:text-[#DA291C] font-bold transition-colors cursor-pointer"
                  >
                    {commentsList.length} Comments
                  </button>
                </div>

                {/* Direct Action Buttons: Like, Comment toggle */}
                <div className="grid grid-cols-2 gap-1.5 text-center text-xs font-bold text-slate-500">
                  <button
                    onClick={() => handleLikePost(post.id)}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      hasLiked
                        ? "bg-[#DA291C]/10 text-[#DA291C]"
                        : "hover:bg-slate-50 hover:text-slate-800"
                    }`}
                    id={`like-btn-${post.id}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{hasLiked ? "Liked" : "Like"}</span>
                  </button>
                  <button
                    onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                    className={`py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      activeCommentPostId === post.id
                        ? "bg-slate-100 text-slate-800"
                        : "hover:bg-slate-5 hover:text-slate-800"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Comment</span>
                  </button>
                </div>

                {/* COMMENTS COLLAPSIBLE PORTAL */}
                {activeCommentPostId === post.id && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100" id={`comments-block-${post.id}`}>
                    
                    {/* List comment entries */}
                    {commentsList.length > 0 && (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {commentsList.map((cmt) => (
                           <div key={cmt.id} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl border border-slate-150">
                            {/* Avatar initials */}
                            <div className="w-6.5 h-6.5 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-[9px] font-extrabold text-slate-700 shrink-0">
                              {cmt.author.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-800">{cmt.author}</span>
                                <span className="text-[7px] px-1 rounded bg-slate-200 text-slate-600 font-extrabold uppercase">
                                  {cmt.role}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-605 leading-relaxed">{cmt.text}</p>
                            </div>

                            {/* Comment deletion (Only author or manager) */}
                            {(cmt.author === currentSession.username || currentSession.role === "Business Manager") && (
                              <button
                                onClick={() => handleDeleteComment(post.id, cmt.id)}
                                className="text-slate-400 hover:text-[#DA291C] p-0.5"
                                title="Delete comment"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Type Comment Row */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="w-6.5 h-6.5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0 border border-slate-200">
                        {currentSession.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          id={`comment-input-${post.id}`}
                          value={commentInputs[post.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCommentInputs(prev => ({ ...prev, [post.id]: val }));
                          }}
                          placeholder="Write comments for the team responses..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FFC72C]"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#DA291C] transition-colors"
                          title="Publish reply"
                          id={`send-comment-${post.id}`}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Security prompting modal */}
      <SecurityModal
        isOpen={securityModalOpen}
        title={securityModalTitle}
        message={securityModalMessage}
        requirePin={securityModalRequirePin}
        onConfirm={securityModalOnConfirm || (() => {})}
        onCancel={() => setSecurityModalOpen(false)}
      />

      {/* Full-screen Zoomable Image Viewer Modal */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-55 flex flex-col justify-between bg-slate-950/98 text-white select-none transition-all font-sans"
          onWheel={handleWheel}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 border-b border-slate-800/80">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest font-mono text-[#FFC72C] font-bold">
                Live Operations Photo Viewer
              </span>
              <h3 className="text-xs font-bold text-slate-200 truncate max-w-[200px] sm:max-w-md">
                {fullscreenImage.caption || "Feed Photo Spec sheet"}
              </h3>
            </div>
            
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-1 rounded border border-slate-700 font-bold">
                ZOOM: {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setFullscreenImage(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
                title="Close and exit viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Zoomable Viewport */}
          <div 
            className="flex-1 w-full overflow-hidden flex items-center justify-center relative bg-slate-950/50 cursor-zoom-in active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onDoubleClick={() => {
              if (zoomScale !== 1) {
                handleResetZoom();
              } else {
                setZoomScale(2.5);
              }
            }}
          >
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[9px] text-slate-700 font-mono uppercase tracking-widest leading-none z-0 select-none">
              Drag to Pan / Mouse Wheel or Double Click to Zoom
            </div>
            
            <img
              src={fullscreenImage.src}
              alt={fullscreenImage.caption || "Zoomed Specs"}
              style={{
                transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomScale})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.1s ease-out"
              }}
              className="max-w-[95%] max-h-[85vh] w-auto h-auto object-contain select-none shadow-2xl relative z-10 rounded-sm"
              draggable="false"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Controls Bar */}
          <div className="w-full bg-slate-900 border-t border-slate-850/85 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomIn}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 hover:text-[#FFC72C] text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-700"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Zoom In</span>
              </button>
              
              <button
                onClick={handleZoomOut}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 hover:text-[#FFC72C] text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-700"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
                <span>Zoom Out</span>
              </button>

              <button
                onClick={handleResetZoom}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 hover:text-rose-400 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-700"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="text-[10px] text-slate-400 max-w-xs text-center sm:text-right font-sans">
              <span className="text-[#FFC72C] font-extrabold">💡 TIP:</span> Scroll mouse wheel or pinch to zoom. Left-click & drag when zoomed to pan around the image.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
