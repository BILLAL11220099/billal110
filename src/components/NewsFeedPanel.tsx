/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { NewsFeedPost, NewsFeedComment, UserSession } from "../types";
import {
  MessageSquare, ThumbsUp, Send, Image as ImageIcon, Trash2, Edit3,
  X, CheckSquare, Sparkles, HelpCircle, Save, Megaphone
} from "lucide-react";
import SecurityModal from "./SecurityModal";

interface NewsFeedPanelProps {
  feed: NewsFeedPost[];
  currentSession: UserSession;
  onSave: (feedList: NewsFeedPost[]) => void;
}

export default function NewsFeedPanel({
  feed,
  currentSession,
  onSave
}: NewsFeedPanelProps) {
  // Input states
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState<string | undefined>(undefined);
  const [newPostImageName, setNewPostImageName] = useState("");
  
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
      const base64 = reader.result as string;
      if (isEdit) {
        setEditPostImage(base64);
      } else {
        setNewPostImage(base64);
      }
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

      {/* CREATE POST CARD - FACEBOOK BOX STYLE */}
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
                placeholder="Type the exact name/label as you see in the photo..."
                className="w-full bg-white border border-slate-250/90 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 placeholder-slate-400 focus:outline-none focus:border-[#DA291C]"
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

      {/* FEED POSTS TIMELINE */}
      <div className="space-y-3">
        {feed.length === 0 ? (
          <div className="p-10 text-center rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
            <p className="text-xs font-bold text-slate-700">Your Operations feed is currently silent.</p>
            <p className="text-[11px] text-slate-400">Be the first to post any shift updates or capture checklist photos!</p>
          </div>
        ) : (
          feed.map((post) => {
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
                            className="max-h-[350px] w-auto object-contain rounded-lg hover:scale-[1.002] transition-transform duration-150"
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

    </div>
  );
}
