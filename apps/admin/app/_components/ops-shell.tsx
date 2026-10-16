"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { opsGet, opsMutation } from "../_lib/api";

interface NavItemDef {
  href: string;
  label: string;
  icon: string;
  permission: string;
  badge?: string;
  badgeType?: "amber" | "purple" | "coral" | "green";
}

interface NavSectionDef {
  id: string;
  title: string;
  subsections: {
    title?: string;
    items: NavItemDef[];
  }[];
}

const SECTIONS: NavSectionDef[] = [
  {
    id: "core-ops",
    title: "Core Operations",
    subsections: [
      {
        items: [
          { href: "/", label: "Overview", icon: "📊", permission: "ops.dashboard.read" }
        ]
      },
      {
        title: "Disbursements",
        items: [
          { href: "/payouts", label: "Payout Batches", icon: "💳", permission: "ops.dashboard.read", badge: "3", badgeType: "amber" },
          { href: "/payouts/create", label: "Batch Calculator", icon: "⚡", permission: "ops.dashboard.read" },
          { href: "/refunds", label: "Refunds & Disputes", icon: "↩️", permission: "ops.disputes.review", badge: "4", badgeType: "purple" }
        ]
      },
      {
        title: "Reconciliation",
        items: [
          { href: "/exceptions", label: "Exceptions & Holds", icon: "⚠️", permission: "ops.reconciliation.read", badge: "2", badgeType: "coral" },
          { href: "/financial-tiers", label: "Financial Tiers", icon: "🎚️", permission: "ops.tiers.read" }
        ]
      }
    ]
  },
  {
    id: "risk-telemetry",
    title: "Risk & Telemetry",
    subsections: [
      {
        title: "Infrastructure Rails",
        items: [
          { href: "/providers", label: "Provider Circuits", icon: "🔌", permission: "ops.dashboard.read", badge: "99.8%", badgeType: "green" },
          { href: "/notifications", label: "Delivery Health", icon: "📡", permission: "ops.notifications.read" }
        ]
      },
      {
        title: "Assurance & Logs",
        items: [
          { href: "/compliance", label: "Identity Review", icon: "🛡️", permission: "ops.compliance.read", badge: "6", badgeType: "amber" },
          { href: "/audit", label: "Audit Journal", icon: "📜", permission: "ops.audit.read" },
          { href: "/reports", label: "Financial Reports", icon: "📈", permission: "ops.reports.read" }
        ]
      }
    ]
  },
  {
    id: "governance-access",
    title: "Governance & Access",
    subsections: [
      {
        title: "Owner Administration",
        items: [
          { href: "/owner", label: "Owner Control", icon: "👑", permission: "SUPER_ADMIN" },
          { href: "/config", label: "Configuration", icon: "⚙️", permission: "ops.owner.read" }
        ]
      },
      {
        title: "Identities",
        items: [
          { href: "/owner/staff", label: "Staff Governance", icon: "👥", permission: "SUPER_ADMIN" },
          { href: "/owner/customers", label: "Customer Master", icon: "🏢", permission: "SUPER_ADMIN" }
        ]
      },
      {
        title: "Security & Support",
        items: [
          { href: "/support", label: "Support Cases", icon: "🎧", permission: "ops.support.read" },
          { href: "/security", label: "Security & MFA", icon: "🔒", permission: "" }
        ]
      }
    ]
  }
];

export function OpsShell({
  title,
  eyebrow = "Restricted · audited",
  actions,
  children
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    opsGet<any>("/auth/me")
      .then((v) => {
        setUser(v);
        const allowed =
          Array.isArray(v?.permissions) &&
          v.permissions.some((p: string) => p.startsWith("ops."));
        if (!allowed) router.replace("/login");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    try {
      await opsMutation("/auth/logout");
    } finally {
      router.replace("/login");
    }
  }

  const isOwner = user?.roles?.includes("SUPER_ADMIN");

  function toggleSection(sectionId: string) {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  }

  // Count visible items per section based on permissions
  function countVisibleItems(sec: NavSectionDef) {
    let count = 0;
    sec.subsections.forEach((sub) => {
      sub.items.forEach((item) => {
        if (!item.permission || isOwner || user?.permissions?.includes(item.permission)) {
          count++;
        }
      });
    });
    return count;
  }

  const userEmail = user?.user?.email || "admin@twipay.com";
  const userInitials = userEmail.slice(0, 2).toUpperCase();
  const roleName = isOwner ? "SUPER_ADMIN" : user?.roles?.[0] || "OPERATOR";
  const mfaLabel = user?.mfaSatisfied ? "MFA Satisfied 🔒" : "MFA Step-up Pending";

  return (
    <div className="ops-frame">
      {/* Top Application Bar */}
      <header className="ops-topbar">
        <Link href="/" className="app-brand">
          <div className="app-brand-logo">T</div>
          <div className="app-brand-text">
            <h2>TwiPay™</h2>
            <p>Operations Portal</p>
          </div>
        </Link>

        {/* Global Search Box */}
        <div className="app-search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search accounts, users, batches, journal entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* User Profile Chip */}
        <div className="user-profile-chip">
          <div className="user-avatar">{userInitials}</div>
          <div className="user-details">
            <span className="user-name">{userEmail}</span>
            <span className="user-role-badge">{roleName}</span>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar + Viewport */}
      <div className="app-body">
        {/* Pinned Lateral Sidebar */}
        <aside className="app-sidebar">
          {/* Dual-Control Quorum Widget */}
          <div className="sidebar-widget">
            <div className="sidebar-widget-header">
              <span>Dual-Control Quorum</span>
              <span className="sidebar-status-pill">● ACTIVE</span>
            </div>
            <Link href="/owner" className="sidebar-widget-link">
              <span>2 Owners Enrolled</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* Independent Scroll Area (Items scroll, footer stays pinned) */}
          <div className="sidebar-scroll-area">
            {SECTIONS.map((sec) => {
              const visibleCount = countVisibleItems(sec);
              if (visibleCount === 0) return null;
              const isCollapsed = !!collapsedSections[sec.id];

              return (
                <div
                  className={`sidebar-section-group ${isCollapsed ? "collapsed" : ""}`}
                  key={sec.id}
                >
                  <div
                    className="sidebar-section-header"
                    onClick={() => toggleSection(sec.id)}
                    title="Click to toggle section"
                  >
                    <div className="section-header-left">
                      <span>{sec.title}</span>
                      <span className="section-count-tag">{visibleCount}</span>
                    </div>
                    <span className="section-chevron">▾</span>
                  </div>

                  <div className="collapsible-content">
                    {sec.subsections.map((sub, sIdx) => {
                      const filteredItems = sub.items.filter(
                        (i) => !i.permission || isOwner || user?.permissions?.includes(i.permission)
                      );
                      if (filteredItems.length === 0) return null;

                      return (
                        <div key={sIdx} className={sub.title ? "sidebar-subsection" : ""}>
                          {sub.title && (
                            <span className="sidebar-subsection-title">{sub.title}</span>
                          )}
                          <ul className="nav-list">
                            {filteredItems.map((item) => {
                              const isActive = path === item.href;
                              return (
                                <li key={item.href}>
                                  <Link
                                    href={item.href}
                                    className={`nav-item ${isActive ? "active" : ""}`}
                                  >
                                    <div className="nav-item-left">
                                      <div className="nav-icon-box">{item.icon}</div>
                                      <span>{item.label}</span>
                                    </div>
                                    {item.badge && (
                                      <span
                                        className={`nav-item-badge badge-${item.badgeType || "amber"}`}
                                      >
                                        {item.badge}
                                      </span>
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* STRICTLY PINNED USER FOOTER (NEVER SCROLLS OUT OF VIEW) */}
          <div className="sidebar-user-footer">
            <div className="sidebar-user-info">
              <div className="sidebar-user-avatar">
                {userInitials}
                <span className="sidebar-online-dot" />
              </div>
              <div className="sidebar-user-text">
                <span className="sidebar-user-email">{userEmail}</span>
                <span className="sidebar-user-role">
                  {roleName} &bull; {mfaLabel}
                </span>
              </div>
            </div>
            <button
              className="sidebar-logout-btn"
              title="Sign out of Operations"
              onClick={logout}
            >
              &#x21aa;
            </button>
          </div>
        </aside>

        {/* Dynamic Route Content */}
        <main className="ops-main">
          <div className="page-header-row">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
            </div>
            {actions && <div className="actions-inline">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
