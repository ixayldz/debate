/**
 * Entity interfaces for PostgreSQL table rows.
 * All field names match snake_case column names from the database.
 */

export interface IUser {
    id: number;
    username: string;
    display_name: string;
    email: string | null;
    password: string | null;
    phone: string | null;
    avatar_url: string | null;
    bio: string | null;
    language: string;
    status: string;
    providers: Record<string, any>;
    interests: string[] | null;
    is_admin: boolean;
    is_verified: boolean;
    follower_count: number;
    following_count: number;
    created_at: Date;
    updated_at: Date;
}

export interface IRoom {
    id: number;
    title: string;
    description: string | null;
    category: string | null;
    category_id: number | null;
    language: string;
    visibility: 'public' | 'private';
    status: string;
    max_speakers: number;
    mic_requests_enabled: boolean;
    created_by: number;
    designated_successor: number | null;
    tags: string[] | null;
    viewer_count: number;
    is_featured: boolean;
    grace_period_end: Date | null;
    started_at: Date | null;
    ended_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface IRoomParticipant {
    id: number;
    room_id: number;
    user_id: number;
    role: string;
    is_muted: boolean;
    is_hand_raised: boolean;
    stage_joined_at: Date | null;
    joined_at: Date;
    // Joined from room_participants + users table
    username?: string;
    display_name?: string;
    avatar_url?: string;
}

export interface IRoomBan {
    id: number;
    room_id: number;
    user_id: number;
    banned_by: number | null;
    reason: string | null;
    created_at: Date;
}

export interface INotification {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string | null;
    data: any;
    is_read: boolean;
    created_at: Date;
}

export interface IUserFollow {
    id: number;
    follower_id: number;
    following_id: number;
    created_at: Date;
}

export interface IUserBlock {
    id: number;
    blocker_id: number;
    blocked_id: number;
    created_at: Date;
}
