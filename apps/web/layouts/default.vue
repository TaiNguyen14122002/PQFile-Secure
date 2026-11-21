<script setup lang="ts">
import {
  ShieldCheck, Home, FolderClosed, Share2, FileUp, KeyRound, UsersRound,
  Clock3, ChevronDown, LogOut, Settings2,
  Menu, X, ShieldAlert, Network, BrainCircuit, Bell, Search, PanelLeftClose,
  PanelLeftOpen, LockKeyhole, Atom, FlaskConical
} from 'lucide-vue-next';

const { user, logout } = useAuth();
const route = useRoute();
const unreadAlerts = ref(0);
const profileMenu = ref(false);
const mobileMenu = ref(false);
const collapsed = ref(false);
const isDesktop = ref(false);
const mobileTrigger = ref<HTMLButtonElement | null>(null);
const sidebarCloseButton = ref<HTMLButtonElement | null>(null);
const sidebarElement = ref<HTMLElement | null>(null);
let breakpoint: MediaQueryList | null = null;
const SIDEBAR_STORAGE_KEY = 'pqfile:sidebar-collapsed';

// Đưa mô-đun mới vào đây để có điều hướng tự động theo nhóm.
const navigation = [
  { key: 'overview', title: 'TỔNG QUAN', items: [
    { to: '/dashboard', label: 'Bảng điều khiển', icon: Home }
  ] },
  { key: 'files', title: 'TỆP TIN & CỘNG TÁC', items: [
    { to: '/files?tab=all', label: 'Thư viện tệp', icon: FolderClosed },
    { to: '/upload', label: 'Tải lên & mã hóa', icon: FileUp },
    { to: '/shared', label: 'Tệp được chia sẻ', icon: Share2 },
    { to: '/keys', label: 'Kho khóa mật mã', icon: KeyRound },
    { to: '/pqc', label: 'Mật mã nâng cao', icon: Atom },
    { to: '/onboarding', label: 'Mô phỏng & tư vấn', icon: FlaskConical },
    { to: '/workspaces', label: 'Nhóm làm việc', icon: UsersRound }
  ] },
  { key: 'intelligence', title: 'AI & AN NINH', items: [
    { to: '/smart', label: 'Tìm kiếm & tóm tắt', icon: BrainCircuit },
    { to: '/security', label: 'Giám sát an ninh', icon: ShieldAlert },
    { to: '/governance', label: 'Quản trị quyền', icon: Network }
  ] },
  { key: 'system', title: 'HOẠT ĐỘNG', items: [
    { to: '/activity', label: 'Nhật ký hoạt động', icon: Clock3 }
  ] }
];
const openGroups = ref<Record<string, boolean>>({ overview: true, files: true, intelligence: true, system: true });
const isProtected = computed(() => Boolean(user.value) && !['/', '/login', '/register'].includes(route.path));
const navCompact = computed(() => isDesktop.value && collapsed.value);
const sidebarInert = computed(() => !isDesktop.value && !mobileMenu.value);
const initials = computed(() => user.value?.displayName?.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase() || '?');
const currentPage = computed(() => {
  if (route.path === '/files') return route.query.tab === 'received' ? 'Tệp được chia sẻ' : 'Thư viện tệp mã hóa';
  for (const group of navigation) {
    const found = group.items.find(item => item.to === route.path);
    if (found) return found.label;
  }
  return route.path === '/register' ? 'Đăng ký' : route.path === '/login' ? 'Đăng nhập' : 'PQFile Secure';
});
function isActive(to: string) {
  if (to === '/shared') return route.path === '/shared' || (route.path === '/files' && route.query.tab === 'received');
  if (to === '/files?tab=all') return route.path === '/files' && route.query.tab !== 'received';
  return route.path === to;
}
function closeMenus() { profileMenu.value = false; mobileMenu.value = false; }
function closeMobile(restoreFocus = false) {
  if (!mobileMenu.value) return;
  mobileMenu.value = false;
  if (restoreFocus) nextTick(() => mobileTrigger.value?.focus());
}
function openMobile() {
  profileMenu.value = false;
  mobileMenu.value = true;
  nextTick(() => sidebarCloseButton.value?.focus());
}
function toggleCollapsed() {
  collapsed.value = !collapsed.value;
  try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed.value)); } catch { /* private browsing */ }
}
function syncBreakpoint() {
  isDesktop.value = Boolean(breakpoint?.matches);
  if (isDesktop.value) mobileMenu.value = false;
}
function onSidebarKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeMobile(true); return; }
  if (!mobileMenu.value || isDesktop.value || event.key !== 'Tab') return;
  const focusables = Array.from(sidebarElement.value?.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) || []).filter(el => el.getClientRects().length > 0);
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
async function refreshAlerts() {
  if (!user.value) { unreadAlerts.value = 0; return; }
  try {
    const summary = await requestApi<{ unread: number }>('/security/summary');
    unreadAlerts.value = summary.unread || 0;
  } catch { unreadAlerts.value = 0; }
}
function onGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (mobileMenu.value) closeMobile(true);
    profileMenu.value = false;
  }
}
watch(mobileMenu, open => {
  if (import.meta.client) document.body.classList.toggle('pq-sidebar-open', open && !isDesktop.value);
});
watch(() => route.fullPath, () => {
  closeMenus();
  const activeGroup = navigation.find(group => group.items.some(item => isActive(item.to)));
  if (activeGroup) openGroups.value[activeGroup.key] = true;
  void refreshAlerts();
});
watch(() => user.value?.id, () => { closeMenus(); void refreshAlerts(); });
onMounted(() => {
  try { collapsed.value = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'; } catch { /* private browsing */ }
  breakpoint = window.matchMedia('(min-width: 1024px)');
  syncBreakpoint();
  breakpoint.addEventListener('change', syncBreakpoint);
  document.addEventListener('keydown', onGlobalKeydown);
  void refreshAlerts();
});
onUnmounted(() => {
  breakpoint?.removeEventListener('change', syncBreakpoint);
  document.removeEventListener('keydown', onGlobalKeydown);
  document.body.classList.remove('pq-sidebar-open');
});
</script>

<template>
  <div class="pq-app-shell min-h-screen"
       :class="{
         'pq-app-shell--dashboard': route.path === '/dashboard',
         'pq-with-sidebar': isProtected,
         'pq-sidebar-collapsed': isProtected && navCompact,
         'pq-public-layout': !isProtected
       }">
    <a href="#main-content" class="pq-skip-link">Bỏ qua điều hướng đến nội dung</a>

    <Transition name="pq-sidebar-fade">
      <button v-if="isProtected && mobileMenu && !isDesktop" type="button"
              class="pq-sidebar-backdrop" aria-label="Đóng thanh điều hướng"
              @click="closeMobile(true)" />
    </Transition>

    <aside v-if="isProtected" ref="sidebarElement" id="pq-main-sidebar"
           class="pq-nav-sidebar" :class="{ 'is-collapsed': navCompact, 'is-open': mobileMenu }"
           aria-label="Thanh điều hướng chính"
           :aria-hidden="sidebarInert ? 'true' : undefined"
           :inert="sidebarInert ? true : undefined"
           @keydown="onSidebarKeydown">
      <div class="pq-sidebar-brand-row">
        <NuxtLink to="/dashboard" class="pq-sidebar-brand" :title="navCompact ? 'PQFile Secure' : undefined" aria-label="PQFile Secure – trang chủ">
          <span class="pq-sidebar-logo"><ShieldCheck :size="27" :stroke-width="2.3" /></span>
          <span v-if="!navCompact" class="pq-sidebar-brand-copy">
            <strong>PQFile <em>Secure</em></strong>
            <small>Bảo mật hậu lượng tử</small>
          </span>
        </NuxtLink>
        <button v-if="!isDesktop" ref="sidebarCloseButton" type="button" class="pq-sidebar-icon-button pq-sidebar-mobile-close"
                aria-label="Đóng thanh bên" @click="closeMobile(true)"><X :size="21" /></button>
        <button v-else type="button" class="pq-sidebar-icon-button pq-sidebar-collapse-toggle"
                :title="collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
                :aria-label="collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
                :aria-expanded="!collapsed" aria-controls="pq-sidebar-navigation"
                @click="toggleCollapsed"><PanelLeftOpen v-if="collapsed" :size="20"/><PanelLeftClose v-else :size="20"/></button>
      </div>

      <NuxtLink to="/upload" class="pq-sidebar-upload" :class="{'pq-sidebar-upload--icon':navCompact}"
                :title="navCompact ? 'Tải lên & mã hóa' : undefined" aria-label="Tải lên và mã hóa tệp"
                @click="closeMobile()">
        <FileUp :size="20"/><span v-if="!navCompact">Tải tệp mới</span>
      </NuxtLink>

      <nav id="pq-sidebar-navigation" class="pq-sidebar-navigation" aria-label="Các chức năng PQFile Secure">
        <section v-for="group in navigation" :key="group.key" class="pq-sidebar-section" :aria-label="group.title">
          <button v-if="!navCompact" type="button" class="pq-sidebar-group-title"
                  :aria-expanded="openGroups[group.key]" :aria-controls="`pq-nav-group-${group.key}`"
                  @click="openGroups[group.key] = !openGroups[group.key]">
            <span>{{ group.title }}</span><ChevronDown :size="14" :class="{'pq-chevron-closed':!openGroups[group.key]}"/>
          </button>
          <div v-else class="pq-sidebar-group-divider" :title="group.title" aria-hidden="true" />
          <div v-show="navCompact || openGroups[group.key]" :id="`pq-nav-group-${group.key}`" class="pq-sidebar-group-links">
            <NuxtLink v-for="item in group.items" :key="item.to" :to="item.to"
                      class="pq-sidebar-link" :class="{'pq-sidebar-link--active': isActive(item.to)}"
                      :title="navCompact ? item.label : undefined"
                      :aria-label="item.label" :aria-current="isActive(item.to) ? 'page' : undefined"
                      @click="closeMobile()">
              <component :is="item.icon" :size="20" :stroke-width="2.05" class="pq-sidebar-link-icon"/>
              <span v-if="!navCompact" class="pq-sidebar-link-text">{{ item.label }}</span>
              <span v-if="item.to === '/security' && unreadAlerts > 0"
                    class="pq-sidebar-alert-badge" :class="{'is-compact':navCompact}">{{ unreadAlerts > 99 ? '99+' : unreadAlerts }}</span>
            </NuxtLink>
          </div>
        </section>
      </nav>

      <div class="pq-sidebar-bottom">
        <div v-if="!navCompact" class="pq-sidebar-assurance">
          <LockKeyhole :size="17"/><span>Nội dung tệp được mã hóa trên thiết bị</span>
        </div>
        <div class="pq-sidebar-user" :title="user?.email" :class="{'pq-sidebar-user--compact':navCompact}">
          <span class="pq-sidebar-avatar">{{ initials }}</span>
          <span v-if="!navCompact" class="pq-sidebar-user-copy"><strong>{{ user?.displayName }}</strong><small>{{ user?.email }}</small></span>
        </div>
      </div>
    </aside>

    <div class="pq-layout-frame">
      <header class="pq-topbar" aria-label="Thanh công cụ">
        <div class="pq-topbar-start">
          <button v-if="isProtected && !isDesktop" ref="mobileTrigger" type="button" class="pq-topbar-icon-btn"
                  aria-label="Mở thanh điều hướng" aria-controls="pq-main-sidebar" :aria-expanded="mobileMenu"
                  @click="openMobile"><Menu :size="23"/></button>
          <NuxtLink v-if="!isProtected" to="/dashboard" class="pq-public-brand" aria-label="PQFile Secure – trang chủ">
            <span class="pq-public-brand-icon"><ShieldCheck :size="25"/></span><strong>PQFile <span>Secure</span></strong>
          </NuxtLink>
          <div v-else class="pq-topbar-current">
            <span class="pq-topbar-overline">PQFILE SECURE / KHÔNG GIAN LÀM VIỆC</span>
            <strong>{{ currentPage }}</strong>
          </div>
        </div>
        <div class="pq-topbar-actions">
          <span v-if="isProtected" class="pq-topbar-status"><ShieldCheck :size="15"/> Bảo vệ hậu lượng tử</span>
          <NuxtLink v-if="isProtected" to="/smart" class="pq-topbar-icon-btn pq-topbar-tool" title="Tìm kiếm tài liệu"
                    aria-label="Tìm kiếm tài liệu"><Search :size="20"/></NuxtLink>
          <NuxtLink v-if="isProtected" to="/security" class="pq-topbar-icon-btn pq-topbar-tool pq-topbar-bell" title="Cảnh báo an ninh"
                    aria-label="Xem cảnh báo an ninh"><Bell :size="20"/><span v-if="unreadAlerts > 0" class="pq-topbar-bell-count">{{unreadAlerts > 99 ? '99+' : unreadAlerts}}</span></NuxtLink>
          <div v-if="user" class="pq-account-area">
            <button type="button" class="pq-topbar-account" :aria-expanded="profileMenu" aria-haspopup="menu"
                    aria-label="Tài khoản và cài đặt" @click="profileMenu = !profileMenu;mobileMenu = false">
              <span class="pq-account-avatar">{{ initials }}</span>
              <span class="pq-account-name">{{user.displayName}}</span><ChevronDown :size="15" />
            </button>
            <div v-if="profileMenu" class="pq-account-menu" role="menu" aria-label="Tài khoản">
              <p class="pq-account-email">{{ user.email }}</p>
              <NuxtLink to="/keys" role="menuitem" class="pq-account-menu-action" @click="profileMenu=false"><Settings2 :size="18"/> Quản lý khóa</NuxtLink>
              <button type="button" role="menuitem" class="pq-account-menu-action pq-account-logout" @click="profileMenu=false;logout()"><LogOut :size="18"/> Đăng xuất</button>
            </div>
          </div>
          <NuxtLink v-else to="/login" class="primary-button !px-4 !py-2 text-sm">Đăng nhập</NuxtLink>
        </div>
      </header>
      <main id="main-content" tabindex="-1" class="pq-layout-main"><slot/></main>
      <footer v-if="!['/dashboard', '/workspaces', '/smart', '/security', '/governance', '/activity', '/upload'].includes(route.path)" class="pq-layout-footer">PQFile Secure · Nghiên cứu mật mã hậu lượng tử · Tệp được mã hóa trên trình duyệt trước khi tải lên</footer>
    </div>
  </div>
</template>
