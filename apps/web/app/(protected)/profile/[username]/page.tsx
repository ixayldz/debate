'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldBan, UserPlus, UserRoundMinus } from 'lucide-react';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card } from '@/components/common/ui';
import {
  blockUser,
  followUser,
  getFollowers,
  getFollowing,
  getMe,
  getProfileByUsername,
  searchUsers,
  unfollowUser,
  unblockUser,
} from '@/lib/api/users-api';

function normalizeUsername(input: string | string[] | undefined): string {
  if (!input) {
    return '';
  }
  return Array.isArray(input) ? input[0] : input;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = normalizeUsername(params?.username);
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(),
  });

  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => getProfileByUsername(username),
    enabled: Boolean(username),
  });

  const lookupQuery = useQuery({
    queryKey: ['profile-lookup', username],
    queryFn: () => searchUsers(username, 20),
    enabled: Boolean(username),
  });

  const targetUser = useMemo(() => {
    const list = lookupQuery.data || [];
    return list.find((user) => user.username.toLowerCase() === username.toLowerCase()) || list[0];
  }, [lookupQuery.data, username]);

  const targetUserId = targetUser ? String(targetUser.id) : '';

  const followersQuery = useQuery({
    queryKey: ['profile', targetUserId, 'followers'],
    queryFn: () => getFollowers(targetUserId, 1, 20),
    enabled: Boolean(targetUserId),
  });

  const followingQuery = useQuery({
    queryKey: ['profile', targetUserId, 'following'],
    queryFn: () => getFollowing(targetUserId, 1, 20),
    enabled: Boolean(targetUserId),
  });

  const isFollowing = useMemo(() => {
    const meId = meQuery.data?.id;
    if (!meId || !followersQuery.data) {
      return false;
    }
    return followersQuery.data.users.some((user) => user.id === meId);
  }, [followersQuery.data, meQuery.data?.id]);

  const updateSocialLists = () => {
    void queryClient.invalidateQueries({ queryKey: ['profile', targetUserId, 'followers'] });
    void queryClient.invalidateQueries({ queryKey: ['profile', targetUserId, 'following'] });
  };

  const followMutation = useMutation({
    mutationFn: () => followUser(targetUserId),
    onSuccess: () => updateSocialLists(),
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowUser(targetUserId),
    onSuccess: () => updateSocialLists(),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(targetUserId),
    onSuccess: () => updateSocialLists(),
  });

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(targetUserId),
    onSuccess: () => updateSocialLists(),
  });

  if (!username) {
    return (
      <MobileShell title="Profil">
        <Card>Invalid profile path.</Card>
      </MobileShell>
    );
  }

  const displayName = profileQuery.data?.display_name || targetUser?.displayName || targetUser?.display_name || username;
  const bio = profileQuery.data?.bio || targetUser?.bio || 'No bio yet.';
  const isOwnProfile = meQuery.data?.username.toLowerCase() === username.toLowerCase();

  return (
    <MobileShell title="Profil">
      <Card className="space-y-2 text-center">
        <div className="mx-auto h-20 w-20 rounded-full border border-border bg-muted" />
        <h2 className="font-display text-2xl">{displayName}</h2>
        <p className="text-sm text-text/65">@{username}</p>
        <p className="text-sm text-text/75">{bio}</p>
        <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
          <div className="rounded-xl border border-border bg-base p-2">
            <p className="font-semibold">{followersQuery.data?.total ?? 0}</p>
            <p className="text-xs text-text/65">Followers</p>
          </div>
          <div className="rounded-xl border border-border bg-base p-2">
            <p className="font-semibold">{followingQuery.data?.total ?? 0}</p>
            <p className="text-xs text-text/65">Following</p>
          </div>
        </div>
      </Card>

      {!isOwnProfile ? (
        <Card className="grid grid-cols-2 gap-2">
          {isFollowing ? (
            <Button
              type="button"
              className="flex items-center justify-center gap-2"
              onClick={() => unfollowMutation.mutate()}
              disabled={!targetUserId || unfollowMutation.isPending}
            >
              <UserRoundMinus className="h-4 w-4" />
              {unfollowMutation.isPending ? 'Updating...' : 'Unfollow'}
            </Button>
          ) : (
            <Button
              type="button"
              className="flex items-center justify-center gap-2"
              onClick={() => followMutation.mutate()}
              disabled={!targetUserId || followMutation.isPending}
            >
              <UserPlus className="h-4 w-4" />
              {followMutation.isPending ? 'Updating...' : 'Follow'}
            </Button>
          )}

          <Button
            type="button"
            className="flex items-center justify-center gap-2 bg-[#dbcab0]"
            onClick={() => blockMutation.mutate()}
            disabled={!targetUserId || blockMutation.isPending}
          >
            <ShieldBan className="h-4 w-4" />
            {blockMutation.isPending ? 'Blocking...' : 'Block'}
          </Button>

          <Button
            type="button"
            className="col-span-2"
            onClick={() => unblockMutation.mutate()}
            disabled={!targetUserId || unblockMutation.isPending}
          >
            {unblockMutation.isPending ? 'Updating...' : 'Unblock'}
          </Button>
        </Card>
      ) : null}

      <Card className="space-y-2">
        <h3 className="font-semibold">Recent Followers</h3>
        {(followersQuery.data?.users || []).slice(0, 6).map((user) => (
          <div key={user.id} className="rounded-2xl border border-border bg-base px-3 py-2">
            <p className="text-sm font-medium">{user.displayName || user.display_name || user.username}</p>
            <p className="text-xs text-text/60">@{user.username}</p>
          </div>
        ))}
      </Card>
    </MobileShell>
  );
}
