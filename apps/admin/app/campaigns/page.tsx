'use client';

import ProtectedLayout from '@/components/protected-layout';
import CampaignsTab from '@/components/campaigns-tab';

export default function CampaignsPage() {
  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-2 text-gray-600">Manage email campaigns</p>
        </div>
        <CampaignsTab />
      </div>
    </ProtectedLayout>
  );
}
