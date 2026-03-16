'use client';

import ProtectedLayout from '@/components/protected-layout';
import { PageHeader } from '@/components/page-header';
import CampaignsTab from '@/components/campaigns-tab';

export default function CampaignsPage() {
  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <PageHeader title="Campaigns" description="Manage email campaigns" />
        <CampaignsTab />
      </div>
    </ProtectedLayout>
  );
}
