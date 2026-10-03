
export interface Profile {
  id: string;
  bio: string | null;
  skills: string[] | null;
  interests: string[] | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  kaggle_url: string | null;
  leetcode_url: string | null;
  codeforces_url: string | null;
  codechef_url: string | null;
  gfg_url: string | null;
  hackerrank_url: string | null;
  updated_at: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  profiles?: Profile;
  users?: {
    name: string | null;
    image: string | null;
  };
  community_comments?: CommunityComment[];
  _count?: {
    community_comments: number;
  }
}

export interface CommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // Joins
  profiles?: Profile;
  users?: {
    name: string | null;
    image: string | null;
  };
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string | null;
  video_url: string | null;
  project_url: string | null;
  repo_url: string | null;
  tech_stack: string[] | null;
  created_at: string;
  profiles?: Profile;
  users?: {
    name: string | null;
    image: string | null;
  };
}

export interface Resource {
  id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  file_url: string;
  type: string;
  semester: string | null;
  subject: string | null;
  is_verified: boolean;
  created_at: string;
}

// ==========================================
// Certificate System Types
// ==========================================

export type CertificateType = 'participation' | 'winner' | 'speaker' | 'coordinator' | 'volunteer';

export type TextFieldType = 'participant_name' | 'event_name' | 'event_date' | 'certificate_id' | 'organizer_name' | 'role_title';

export interface QRRegion {
  x: number;      // percentage (0-100)
  y: number;      // percentage (0-100)
  width: number;  // percentage (0-100)
  height: number; // percentage (0-100)
}

export interface TextRegion {
  id: string;     // unique identifier for the region
  field: TextFieldType;
  x: number;      // percentage (0-100)
  y: number;      // percentage (0-100)
  fontSize: number;   // in points
  color: string;      // hex color
  fontWeight?: 'normal' | 'bold';
  alignment?: 'left' | 'center' | 'right';
  fontFamily?: string;       // id from CERTIFICATE_FONTS, or 'custom'
  customFontPath?: string;   // storage path in 'certificates' bucket when fontFamily === 'custom'
  letterSpacing?: number;    // extra spacing between letters, same units as fontSize
}

export interface SignatureRegion {
  x: number;      // percentage (0-100)
  y: number;      // percentage (0-100)
  width: number;  // percentage (0-100)
  height: number; // percentage (0-100)
}

export interface CertificateTemplate {
  id: string;
  event_id: string;
  template_url: string;
  qr_region: QRRegion;
  text_regions: TextRegion[];
  signature_url?: string;
  signature_region?: SignatureRegion;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  certificate_id: string;  // Short 8-char display ID
  event_id: string;
  user_id: string;
  template_id: string | null;
  certificate_type: CertificateType;
  role_title?: string;
  position_id?: string | null;
  file_url?: string | null;
  qr_region?: QRRegion | null;
  email_sent_at?: string | null;
  issued_at: string;
  status: 'pending' | 'valid' | 'revoked';
  revoked_at?: string;
  revoked_reason?: string;
  downloaded_count: number;
  linkedin_shares: number;
  view_count: number;
  // Joined data
  event?: {
    title: string;
    start_time: string;
    club_id?: string;
    club?: {
      name: string;
    };
  };
  user?: {
    name: string | null;
    email: string | null;
  };
}

export interface CertificatePosition {
  id: string;
  event_id: string;
  title: string;
  sort_order: number;
  qr_region: QRRegion;
  created_at: string;
  updated_at: string;
}

export interface CertificateWithDetails extends Certificate {
  event: {
    title: string;
    start_time: string;
    club?: {
      name: string;
    };
  };
  user: {
    name: string | null;
    email: string | null;
  };
}

export interface CertificateAnalytics {
  id: string;
  certificate_id: string;
  action_type: 'view' | 'download' | 'linkedin_share' | 'verification';
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface CertificateStats {
  total: number;
  valid: number;
  revoked: number;
  downloads: number;
  views: number;
  linkedin_shares: number;
  by_type: Record<CertificateType, number>;
}
