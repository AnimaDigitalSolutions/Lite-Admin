import {
  HomeIcon,
  PhotoIcon,
  EnvelopeIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  AtSymbolIcon,
  UserCircleIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  DocumentCurrencyDollarIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  navKey: string | null; // null = always visible (locked)
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: HomeIcon, navKey: null },
    ],
  },
  {
    group: 'Content',
    items: [
      { name: 'Media', href: '/media', icon: PhotoIcon, navKey: 'nav_visible_media' },
    ],
  },
  {
    group: 'Leads',
    items: [
      { name: 'Contacts', href: '/contacts', icon: EnvelopeIcon, navKey: 'nav_visible_contacts' },
      { name: 'Compose', href: '/compose', icon: PencilSquareIcon, navKey: 'nav_visible_compose' },
    ],
  },
  {
    group: 'Audience',
    items: [
      { name: 'Subscribers', href: '/subscribers', icon: UsersIcon, navKey: 'nav_visible_subscribers' },
      { name: 'Campaigns', href: '/campaigns', icon: MegaphoneIcon, navKey: 'nav_visible_campaigns' },
    ],
  },
  {
    group: 'Billing',
    items: [
      { name: 'Invoices', href: '/invoices', icon: DocumentCurrencyDollarIcon, navKey: 'nav_visible_invoices' },
    ],
  },
  {
    group: 'Sites',
    items: [
      { name: 'Sites & API Keys', href: '/sites', icon: GlobeAltIcon, navKey: 'nav_visible_sites' },
    ],
  },
  {
    group: 'System',
    items: [
      { name: 'Statistics', href: '/stats', icon: ChartBarIcon, navKey: 'nav_visible_stats' },
      { name: 'Activity Log', href: '/logs', icon: ClipboardDocumentListIcon, navKey: 'nav_visible_logs' },
    ],
  },
  {
    group: 'Configure',
    items: [
      { name: 'Email', href: '/email', icon: AtSymbolIcon, navKey: 'nav_visible_email' },
      { name: 'Email Templates', href: '/email/templates', icon: DocumentTextIcon, navKey: 'nav_visible_email_templates' },
      { name: 'Admin User', href: '/users', icon: UserCircleIcon, navKey: 'nav_visible_users' },
      { name: 'Settings', href: '/settings', icon: CogIcon, navKey: null },
    ],
  },
];
