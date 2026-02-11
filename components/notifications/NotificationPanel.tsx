"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotifications, useMarkAsRead, useCollaborationInvites, useFollowRequests, Notification } from "@/lib/hooks";
import { useAuth } from "@/components/providers/AuthProvider";
import { NotificationSkeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";
import CollaborationInviteCard from "./CollaborationInviteCard";
import FollowRequestCard from "./FollowRequestCard";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Brand-consistent icons using purple, pink, and orange gradients
const icons = {
  close: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  admire: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="admireGradN" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="url(#admireGradN)"
      />
    </svg>
  ),
  snap: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="snapGradN" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path d="M12 2C12 2 10 4 10 6C10 8 12 8 12 8" stroke="url(#snapGradN)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M8.5 8C8.5 7 9 6 10 6C11 6 11.5 7 11.5 8V12" stroke="url(#snapGradN)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M11.5 9C11.5 8 12 7 13 7C14 7 14.5 8 14.5 9V12" stroke="url(#snapGradN)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M14.5 10C14.5 9 15 8 16 8C17 8 17.5 9 17.5 10V14C17.5 17 15.5 20 12 21C8.5 20 6.5 17 6.5 14V11C6.5 10 7 9 8 9C9 9 9.5 10 9.5 11" stroke="url(#snapGradN)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M4 4L6 6M20 4L18 6M12 1V3" stroke="url(#snapGradN)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  ovation: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ovationGradN" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="4" r="2.5" fill="url(#ovationGradN)" />
      <path d="M12 7V14M12 14L8 20M12 14L16 20" stroke="url(#ovationGradN)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9L7 5M12 9L17 5" stroke="url(#ovationGradN)" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 3L5 4M20 3L19 4M4 7H5M19 7H20" stroke="url(#ovationGradN)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  support: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="supportGradN" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="50%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M7 13C5.5 13 4 14.5 4 16C4 17.5 5 19 7 20H11C13 20 14.5 18.5 14.5 17" stroke="url(#supportGradN)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M17 13C18.5 13 20 14.5 20 16C20 17.5 19 19 17 20H13C11 20 9.5 18.5 9.5 17" stroke="url(#supportGradN)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M12 11l-.725-.66C9.4 8.736 8 7.64 8 6.25 8 5.06 8.92 4 10.25 4c.74 0 1.46.405 1.75 1.045C12.29 4.405 13.01 4 13.75 4 15.08 4 16 5.06 16 6.25c0 1.39-1.4 2.486-3.275 4.09L12 11z" fill="url(#supportGradN)" />
    </svg>
  ),
  inspired: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="inspiredGradN" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="50%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M12 2C8.69 2 6 4.69 6 8C6 10.22 7.21 12.16 9 13.19V15C9 15.55 9.45 16 10 16H14C14.55 16 15 15.55 15 15V13.19C16.79 12.16 18 10.22 18 8C18 4.69 15.31 2 12 2Z" fill="url(#inspiredGradN)" />
      <path d="M10 18H14M10 20H14M11 16V18M13 16V18" stroke="url(#inspiredGradN)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 8H4M20 8H21M5.5 3.5L6.5 4.5M18.5 3.5L17.5 4.5" stroke="url(#inspiredGradN)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  applaud: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="applaudGradN" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M6 12C4.5 12 3 13.5 3 15.5C3 17.5 4.5 19 6 19L10 19C10 19 11 17 10 15L8 13C7.5 12.5 7 12 6 12Z" fill="url(#applaudGradN)" opacity="0.9" />
      <path d="M18 12C19.5 12 21 13.5 21 15.5C21 17.5 19.5 19 18 19L14 19C14 19 13 17 14 15L16 13C16.5 12.5 17 12 18 12Z" fill="url(#applaudGradN)" opacity="0.9" />
      <path d="M12 8V6M9 9L7.5 7.5M15 9L16.5 7.5M12 4V3" stroke="url(#applaudGradN)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 13L12 11L13.5 13" stroke="url(#applaudGradN)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  comment: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="commentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        fill="url(#commentGrad)"
      />
    </svg>
  ),
  relay: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="relayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path
        d="M17 1l4 4-4 4"
        stroke="url(#relayGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11V9a4 4 0 0 1 4-4h14"
        stroke="url(#relayGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 23l-4-4 4-4"
        stroke="url(#relayGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 13v2a4 4 0 0 1-4 4H3"
        stroke="url(#relayGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  save: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="saveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path
        d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
        fill="url(#saveGrad)"
      />
    </svg>
  ),
  follow: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="followGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#8e44ad" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="4" fill="url(#followGrad)" />
      <path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        stroke="url(#followGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 11h6m-3-3v6"
        stroke="url(#followGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  followRequest: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="followReqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="4" fill="url(#followReqGrad)" />
      <path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        stroke="url(#followReqGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="10" r="5" fill="url(#followReqGrad)" />
      <text x="18" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">?</text>
    </svg>
  ),
  followRequestAccepted: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="followAcceptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27ae60" />
          <stop offset="100%" stopColor="#2ecc71" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="4" fill="url(#followAcceptGrad)" />
      <path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        stroke="url(#followAcceptGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="10" r="5" fill="url(#followAcceptGrad)" />
      <path d="M16 10l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  reply: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="replyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path
        d="M9 17l-5-5 5-5"
        stroke="url(#replyGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12h12a4 4 0 0 1 4 4v1"
        stroke="url(#replyGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  commentLike: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="commentLikeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path
        d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
        fill="url(#commentLikeGrad)"
      />
    </svg>
  ),
  community: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="communityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="50%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="3" fill="url(#communityGrad)" />
      <circle cx="15" cy="7" r="3" fill="url(#communityGrad)" opacity="0.7" />
      <path
        d="M5.5 21v-1a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1"
        stroke="url(#communityGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  invite: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="inviteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        stroke="url(#inviteGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  approved: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="approvedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#approvedGrad)" />
      <path
        d="M9 12l2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  muted: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="mutedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path
        d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"
        stroke="url(#mutedGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  banned: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="bannedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#bannedGrad)" strokeWidth="2" />
      <path d="M4.93 4.93l14.14 14.14" stroke="url(#bannedGrad)" strokeWidth="2" />
    </svg>
  ),
  joinRequest: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="joinReqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#8e44ad" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="4" fill="url(#joinReqGrad)" />
      <path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        stroke="url(#joinReqGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="12" r="5" stroke="url(#joinReqGrad)" strokeWidth="2" fill="none" />
      <path d="M18 10v4M16 12h4" stroke="url(#joinReqGrad)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  collaborationInvite: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="collabInviteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="50%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="3" fill="url(#collabInviteGrad)" />
      <circle cx="15" cy="7" r="3" fill="url(#collabInviteGrad)" opacity="0.7" />
      <path d="M5.5 21v-1a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1" stroke="url(#collabInviteGrad)" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 2l1 2-1 1-1-1 1-2z" fill="url(#collabInviteGrad)" opacity="0.8" />
      <path d="M8 3l.5 1.5-.5.5-.5-.5.5-1.5z" fill="url(#collabInviteGrad)" opacity="0.6" />
      <path d="M16 3l.5 1.5-.5.5-.5-.5.5-1.5z" fill="url(#collabInviteGrad)" opacity="0.6" />
    </svg>
  ),
  collaborationAccepted: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="collabAcceptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27ae60" />
          <stop offset="100%" stopColor="#2ecc71" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="3" fill="url(#collabAcceptGrad)" />
      <circle cx="15" cy="7" r="3" fill="url(#collabAcceptGrad)" opacity="0.7" />
      <path d="M5.5 21v-1a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1" stroke="url(#collabAcceptGrad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="16" r="4" fill="url(#collabAcceptGrad)" />
      <path d="M16.5 16l1 1 2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  collaborationDeclined: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="collabDeclineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="7" r="3" fill="url(#collabDeclineGrad)" opacity="0.5" />
      <circle cx="15" cy="7" r="3" fill="url(#collabDeclineGrad)" opacity="0.3" />
      <path d="M5.5 21v-1a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1" stroke="url(#collabDeclineGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="18" cy="16" r="4" fill="url(#collabDeclineGrad)" />
      <path d="M16.5 14.5l3 3M19.5 14.5l-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  mention: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="mentionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="3" stroke="url(#mentionGrad)" strokeWidth="2" />
      <path d="M12 5a7 7 0 1 0 7 7v-1a3 3 0 0 0-6 0v1" stroke="url(#mentionGrad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1.5" fill="url(#mentionGrad)" />
    </svg>
  ),
  orderPlaced: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="orderPlacedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <rect x="3" y="6" width="18" height="14" rx="2" stroke="url(#orderPlacedGrad)" strokeWidth="2" />
      <path d="M3 10h18" stroke="url(#orderPlacedGrad)" strokeWidth="2" />
      <path d="M7 14h4M7 17h2" stroke="url(#orderPlacedGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  orderPaid: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="orderPaidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27ae60" />
          <stop offset="100%" stopColor="#2ecc71" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#orderPaidGrad)" strokeWidth="2" />
      <path d="M12 6v2m0 8v2m-4-6h1.5a2.5 2.5 0 010 5H9m6-5h-1.5a2.5 2.5 0 000-5H15" stroke="url(#orderPaidGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  orderStarted: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="orderStartedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="url(#orderStartedGrad)" strokeWidth="2" />
      <path d="M10 8l6 4-6 4V8z" fill="url(#orderStartedGrad)" />
    </svg>
  ),
  orderDelivered: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="orderDeliveredGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4M4 7l8 4M4 7v10l8 4m0-10v10" stroke="url(#orderDeliveredGrad)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  orderCompleted: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="orderCompletedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27ae60" />
          <stop offset="100%" stopColor="#2ecc71" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#orderCompletedGrad)" />
      <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  revisionRequested: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="revisionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path d="M1 4v6h6M23 20v-6h-6" stroke="url(#revisionGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="url(#revisionGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  orderCancelled: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="orderCancelledGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#orderCancelledGrad)" strokeWidth="2" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="url(#orderCancelledGrad)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  reviewReceived: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="reviewGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#reviewGrad)" />
    </svg>
  ),
  orderMessage: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="orderMsgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="url(#orderMsgGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10h8M8 14h4" stroke="url(#orderMsgGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  orderDisputed: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="disputeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="100%" stopColor="#e67e22" />
        </linearGradient>
      </defs>
      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" stroke="url(#disputeGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  disputeResolved: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="resolvedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27ae60" />
          <stop offset="100%" stopColor="#2ecc71" />
        </linearGradient>
      </defs>
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="url(#resolvedGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  refundRequested: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="refundReqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e67e22" />
          <stop offset="100%" stopColor="#f39c12" />
        </linearGradient>
      </defs>
      <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" stroke="url(#refundReqGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  orderRefunded: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="refundedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27ae60" />
          <stop offset="100%" stopColor="#2ecc71" />
        </linearGradient>
      </defs>
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" stroke="url(#refundedGrad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4" stroke="url(#refundedGrad)" strokeWidth="2" />
    </svg>
  ),
  checkAll: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  bell: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="50%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
        stroke="url(#bellGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
};

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'admire':
      return icons.admire;
    case 'snap':
      return icons.snap;
    case 'ovation':
      return icons.ovation;
    case 'support':
      return icons.support;
    case 'inspired':
      return icons.inspired;
    case 'applaud':
      return icons.applaud;
    case 'comment':
      return icons.comment;
    case 'reply':
      return icons.reply;
    case 'comment_like':
      return icons.commentLike;
    case 'relay':
      return icons.relay;
    case 'save':
      return icons.save;
    case 'follow':
      return icons.follow;
    case 'follow_request':
      return icons.followRequest;
    case 'follow_request_accepted':
      return icons.followRequestAccepted;
    case 'community_invite':
      return icons.invite;
    case 'community_join_request':
      return icons.joinRequest;
    case 'community_join_approved':
      return icons.approved;
    case 'community_muted':
      return icons.muted;
    case 'community_banned':
      return icons.banned;
    case 'collaboration_invite':
      return icons.collaborationInvite;
    case 'collaboration_accepted':
      return icons.collaborationAccepted;
    case 'collaboration_declined':
      return icons.collaborationDeclined;
    case 'mention':
      return icons.mention;
    case 'order_placed':
      return icons.orderPlaced;
    case 'order_paid':
      return icons.orderPaid;
    case 'order_started':
      return icons.orderStarted;
    case 'order_delivered':
      return icons.orderDelivered;
    case 'order_completed':
      return icons.orderCompleted;
    case 'revision_requested':
      return icons.revisionRequested;
    case 'order_cancelled':
      return icons.orderCancelled;
    case 'review_received':
      return icons.reviewReceived;
    case 'order_message':
      return icons.orderMessage;
    case 'order_disputed':
      return icons.orderDisputed;
    case 'dispute_resolved':
      return icons.disputeResolved;
    case 'refund_requested':
      return icons.refundRequested;
    case 'order_refunded':
      return icons.orderRefunded;
    default:
      return icons.admire;
  }
}

function getNotificationMessage(notification: Notification): { actor: string; action: string } {
  const actorName = notification.actor?.display_name || notification.actor?.username || "Someone";
  const communityName = notification.community?.name || "a community";
  const postType = notification.post?.type || 'post';

  switch (notification.type) {
    case 'admire':
      return { actor: actorName, action: `admired your ${postType}` };
    case 'snap':
      return { actor: actorName, action: `snapped for your ${postType}` };
    case 'ovation':
      return { actor: actorName, action: `gave a standing ovation to your ${postType}` };
    case 'support':
      return { actor: actorName, action: `showed support for your ${postType}` };
    case 'inspired':
      return { actor: actorName, action: `was inspired by your ${postType}` };
    case 'applaud':
      return { actor: actorName, action: `applauded your ${postType}` };
    case 'comment':
      return { actor: actorName, action: `commented on your ${postType}` };
    case 'reply':
      return { actor: actorName, action: 'replied to your comment' };
    case 'comment_like':
      return { actor: actorName, action: 'liked your comment' };
    case 'relay':
      return { actor: actorName, action: `relayed your ${postType}` };
    case 'save':
      return { actor: actorName, action: `saved your ${postType}` };
    case 'follow':
      return { actor: actorName, action: 'started following you' };
    case 'follow_request':
      return { actor: actorName, action: 'requested to follow you' };
    case 'follow_request_accepted':
      return { actor: actorName, action: 'accepted your follow request' };
    case 'community_invite':
      return { actor: actorName, action: `invited you to join ${communityName}` };
    case 'community_join_request':
      return { actor: actorName, action: `requested to join ${communityName}` };
    case 'community_join_approved':
      return { actor: 'Your request', action: `to join ${communityName} was approved` };
    case 'community_muted':
      return { actor: 'You were', action: `muted in ${communityName}` };
    case 'community_banned':
      return { actor: 'You were', action: `banned from ${communityName}` };
    case 'collaboration_invite':
      return { actor: actorName, action: `invited you to collaborate on their ${postType}` };
    case 'collaboration_accepted':
      return { actor: actorName, action: `accepted your collaboration invite` };
    case 'collaboration_declined':
      return { actor: actorName, action: `declined your collaboration invite` };
    case 'mention':
      return { actor: actorName, action: `mentioned you in their ${postType}` };
    case 'order_placed':
      return { actor: actorName, action: 'placed a new order' };
    case 'order_paid':
      return { actor: actorName, action: 'completed payment for your order' };
    case 'order_started':
      return { actor: actorName, action: 'started working on your order' };
    case 'order_delivered':
      return { actor: actorName, action: 'delivered your order' };
    case 'order_completed':
      return { actor: actorName, action: 'marked your order as completed' };
    case 'revision_requested':
      return { actor: actorName, action: 'requested a revision' };
    case 'order_cancelled':
      return { actor: actorName, action: 'cancelled the order' };
    case 'review_received':
      return { actor: actorName, action: 'left a review on your order' };
    case 'order_message':
      return { actor: actorName, action: 'sent a message in your order' };
    case 'order_disputed':
      return { actor: actorName, action: 'opened a dispute on your order' };
    case 'dispute_resolved':
      return { actor: 'Your dispute', action: 'has been resolved' };
    case 'refund_requested':
      return { actor: actorName, action: 'requested a refund on your order' };
    case 'order_refunded':
      return { actor: 'Your order', action: 'has been refunded' };
    default:
      return { actor: actorName, action: 'interacted with you' };
  }
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onClose
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const router = useRouter();
  const opensCommunityInbox =
    notification.type === "community_join_approved" ||
    notification.type === "community_role_change" ||
    notification.type === "community_muted" ||
    notification.type === "community_banned";

  const getNotificationLink = (): string => {
    // Order-related notifications link to the order page
    if (notification.order_id && (
      notification.type === 'order_placed' ||
      notification.type === 'order_paid' ||
      notification.type === 'order_started' ||
      notification.type === 'order_delivered' ||
      notification.type === 'order_completed' ||
      notification.type === 'revision_requested' ||
      notification.type === 'order_cancelled' ||
      notification.type === 'review_received' ||
      notification.type === 'order_message' ||
      notification.type === 'order_disputed' ||
      notification.type === 'dispute_resolved' ||
      notification.type === 'refund_requested' ||
      notification.type === 'order_refunded'
    )) {
      return `/orders/${notification.order_id}`;
    }
    if (notification.type === 'follow' ||
        notification.type === 'follow_request' ||
        notification.type === 'follow_request_accepted') {
      return `/studio/${notification.actor?.username}`;
    }
    if (notification.type === 'community_join_request' && notification.community?.slug) {
      // Link to the members settings page where admins can approve/reject
      return `/community/${notification.community.slug}/settings/members`;
    }
    if (opensCommunityInbox && notification.community?.slug) {
      return `/messages/community?community=${encodeURIComponent(notification.community.slug)}`;
    }
    if (notification.type.startsWith('community_') && notification.community?.slug) {
      return `/community/${notification.community.slug}`;
    }
    // Collaboration and mention notifications link to the post
    if (notification.type === 'collaboration_invite' ||
        notification.type === 'collaboration_accepted' ||
        notification.type === 'collaboration_declined' ||
        notification.type === 'mention') {
      if (notification.post_id) {
        return `/post/${notification.post_id}`;
      }
    }
    // Reply and comment_like notifications link to post with comment anchor
    if ((notification.type === 'reply' || notification.type === 'comment_like') &&
        notification.post_id && notification.comment_id) {
      return `/post/${notification.post_id}?comment=${notification.comment_id}`;
    }
    if (notification.post_id) {
      return `/post/${notification.post_id}`;
    }
    return `/studio/${notification.actor?.username}`;
  };

  const notificationLink = getNotificationLink();

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!notification.read) {
      await onMarkAsRead(notification.id);
    }
    onClose();
    router.push(notificationLink);
  };

  const message = getNotificationMessage(notification);

  return (
    <Link
      href={notificationLink}
      onClick={handleClick}
      className={`group relative flex gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 block ${
        notification.read
          ? "hover:bg-black/[0.02]"
          : "bg-gradient-to-r from-purple-primary/[0.04] via-pink-vivid/[0.03] to-orange-warm/[0.02]"
      }`}
    >
      {/* Unread indicator line */}
      {!notification.read && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-purple-primary via-pink-vivid to-orange-warm" />
      )}

      {/* Avatar with icon overlay */}
      <div className="relative flex-shrink-0">
        <img
          src={notification.actor?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
          alt=""
          className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm group-hover:ring-purple-primary/20 transition-all"
        />
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center ring-2 ring-white">
          {getNotificationIcon(notification.type)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-ui text-[0.88rem] text-ink leading-relaxed">
          <span className="font-semibold">{message.actor}</span>{" "}
          <span className="text-muted">{message.action}</span>
        </p>

        {/* Content preview for comments */}
        {(notification.type === 'comment' || notification.type === 'reply' || notification.type === 'comment_like') && notification.content && (
          <p className="font-body text-[0.82rem] text-muted/80 mt-1.5 line-clamp-2 pl-3 border-l-2 border-purple-primary/20 italic">
            {notification.content}
          </p>
        )}

        {/* Content preview for mute/ban/join request notifications */}
        {(notification.type === 'community_muted' || notification.type === 'community_banned' || notification.type === 'community_join_request') && notification.content && (
          <p className={`font-body text-[0.82rem] mt-1.5 line-clamp-3 pl-3 border-l-2 ${
            notification.type === 'community_banned'
              ? 'text-red-600/80 border-red-400/40'
              : notification.type === 'community_muted'
              ? 'text-yellow-600/80 border-yellow-400/40'
              : 'text-muted/80 border-purple-primary/20'
          }`}>
            {notification.content}
          </p>
        )}

        {/* Order notification content */}
        {notification.content && notification.order_id && (
          <p className="font-body text-[0.82rem] text-muted/80 mt-1.5 line-clamp-2 pl-3 border-l-2 border-purple-primary/20">
            {notification.content}
          </p>
        )}

        {/* Post preview */}
        {notification.post && notification.type !== 'follow' && !notification.type.startsWith('community_') && !notification.order_id && !notification.content && (
          <p className="font-body text-[0.78rem] text-muted/60 mt-1 line-clamp-1 truncate">
            {notification.post.title || notification.post.content?.substring(0, 60)}...
          </p>
        )}

        {/* Community badge */}
        {notification.type.startsWith('community_') && notification.community && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-gradient-to-r from-purple-primary/[0.08] to-pink-vivid/[0.05] rounded-full">
            {notification.community.avatar_url ? (
              <img
                src={notification.community.avatar_url}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                <span className="text-white text-[0.5rem] font-bold">
                  {notification.community.name.charAt(0)}
                </span>
              </div>
            )}
            <span className="font-ui text-[0.7rem] font-medium bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
              {notification.community.name}
            </span>
          </div>
        )}

        {/* Timestamp */}
        <span className="font-ui text-[0.72rem] text-muted mt-1.5 block">
          {getTimeAgo(notification.created_at)}
        </span>
      </div>
    </Link>
  );
}

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  if (!isOpen) {
    return null;
  }

  return <NotificationPanelContent onClose={onClose} />;
}

function NotificationPanelContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { notifications, loading } = useNotifications(user?.id);
  const { markAsRead, markAllAsRead } = useMarkAsRead();
  const { invites: rawInvites, refetch: refetchInvites } = useCollaborationInvites(user?.id || "");
  // Filter out invites where post or author is null (e.g., deleted posts)
  const invites = rawInvites.filter(invite => invite.post && invite.post.author);
  const { requests: followRequests, accept: acceptFollowRequest, decline: declineFollowRequest, refetch: refetchFollowRequests } = useFollowRequests(user?.id);
  const regularNotifications = notifications.filter(
    (n) => n.type !== "collaboration_invite" && n.type !== "follow_request"
  );
  const regularUnreadCount = regularNotifications.filter((n) => !n.read).length;

  const handleAcceptFollowRequest = async (requesterId: string) => {
    await acceptFollowRequest(requesterId);
    refetchFollowRequests();
  };

  const handleDeclineFollowRequest = async (requesterId: string) => {
    await declineFollowRequest(requesterId);
    refetchFollowRequests();
  };

  // Use a ref for onClose to avoid stale closure in event listener
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleMarkAllAsRead = async () => {
    if (user) {
      await markAllAsRead(user.id);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const markHiddenNotificationsAsRead = async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .in("type", ["follow_request", "collaboration_invite"]);

      if (error) {
        console.warn("[NotificationPanel] Failed to clear hidden invite/request notifications:", error.message);
      }
    };

    markHiddenNotificationsAsRead();
  }, [user?.id, followRequests.length, invites.length]);

  const unreadCount = regularUnreadCount + invites.length + followRequests.length;
  const hasContent = regularNotifications.length > 0 || invites.length > 0 || followRequests.length > 0;

  return (
    <>
      {/* Backdrop - full screen on mobile, starts after sidebar on desktop */}
      <div
        className="fixed inset-0 md:left-[72px] bg-black/30 backdrop-blur-sm z-[9998] animate-fadeIn"
        onClick={onClose}
      />

      {/* Panel - full width on mobile, fixed width on desktop */}
      <div className="fixed top-0 left-0 md:left-[72px] bottom-0 w-full md:w-[400px] bg-white shadow-2xl z-[9999] animate-slideInLeft flex flex-col border-r border-purple-primary/[0.08]">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-black/[0.04]">
          {/* Decorative gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm opacity-60" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-[1.3rem] font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-[0.7rem] font-semibold shadow-sm">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {regularUnreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-purple-primary font-ui text-[0.78rem] font-medium hover:bg-purple-primary/10 transition-all"
                >
                  {icons.checkAll}
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-black/[0.03] flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.06] transition-all"
              >
                {icons.close}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-1">
              {[...Array(5)].map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : !hasContent ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10 flex items-center justify-center">
                  {icons.bell}
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">All caught up!</h3>
              <p className="font-body text-muted text-[0.9rem] leading-relaxed max-w-[240px]">
                No new whispers from the creative cosmos. Check back later.
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {/* Follow Requests Section */}
              {followRequests.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 mb-2">
                    {icons.followRequest}
                    <span className="font-ui text-sm font-medium text-ink">
                      Follow Requests
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary rounded-full font-ui">
                      {followRequests.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {followRequests.map((request) => (
                      <FollowRequestCard
                        key={request.follower_id}
                        request={request}
                        onAccept={handleAcceptFollowRequest}
                        onDecline={handleDeclineFollowRequest}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Collaboration Invites Section */}
              {invites.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 mb-2">
                    {icons.collaborationInvite}
                    <span className="font-ui text-sm font-medium text-ink">
                      Collaboration Invites
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary rounded-full font-ui">
                      {invites.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {invites.map((invite) => (
                      <CollaborationInviteCard
                        key={`${invite.post_id}-${invite.post.author.id}`}
                        invite={invite}
                        userId={user?.id || ""}
                        onRespond={() => {
                          refetchInvites();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Notifications */}
              {regularNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onClose={onClose}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasContent && (
          <div className="px-6 py-3 border-t border-black/[0.04] bg-gradient-to-r from-purple-primary/[0.02] to-pink-vivid/[0.02]">
            <p className="font-ui text-[0.75rem] text-muted/60 text-center">
              Showing your recent activity
            </p>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideInLeft {
          animation: slideInLeft 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
}
