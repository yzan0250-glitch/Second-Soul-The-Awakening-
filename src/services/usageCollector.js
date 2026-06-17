/**
 * SECOND SOUL — Usage Collector
 * V5 — Stability Patched (Syntax Fixed)
 *
 * Converts raw Android UsageEvents timeline into App sessions,
 * then writes them to SQLite via usageStore.
 */

import { getTimelineLastDays } from '../modules/UsageStatsModule';
import { upsertAppSessions } from './usageStore';

// 🌟 全局锁，防止频繁切回前台时，多个SQLite事务冲突
let isSyncing = false;

// ── Category dictionary ───────────────────────────────────────────────────────

const PKG_CATEGORY = {
  // Social
  'com.tencent.mm':              'social',   // WeChat
  'com.tencent.mobileqq':        'social',   // QQ
  'com.sina.weibo':              'social',   // Weibo
  'com.instagram.android':       'social',
  'com.twitter.android':         'social',
  'com.facebook.katana':         'social',
  'com.zhihu.android':           'social',   // Zhihu
  'com.douban.frodo':            'social',   // Douban
  'com.xiaohongshu.android':     'social',   // Xiaohongshu / RED
  'com.linkedin.android':        'social',
  // Content
  'com.ss.android.ugc.aweme':    'content',  // Douyin
  'com.zhihu.android.article':   'content',
  'com.kuaishou.nebula':         'content',  // Kuaishou
  'tv.danmaku.bili':             'content',  // Bilibili
  'com.google.android.youtube':  'content',
  'com.netflix.mediaclient':     'content',
  'com.qidian.QDReader':         'content',  // Qidian novels
  'com.zhangyue.iReader':        'content',  // iReader
  'com.amazon.kindle':           'content',
  'com.duokan.phone.unfree':     'content',  // Duokan
  // Productivity
  'com.microsoft.office.word':   'productivity',
  'com.microsoft.office.excel':  'productivity',
  'com.microsoft.teams':         'productivity',
  'com.notion.id':               'productivity',
  'com.evernote':                'productivity',
  'com.google.android.gm':       'productivity', // Gmail
  'com.netease.mailmaster':      'productivity',
  'com.tencent.work':            'productivity', // WeCom
  'com.alibaba.android.rimet':   'productivity', // DingTalk
  // Browser
  'com.android.chrome':          'browser',
  'org.mozilla.firefox':         'browser',
  'com.mi.globalbrowser':        'browser',
  'com.heytap.browser':          'browser',
  'com.uc.browser.en':           'browser',
  'com.baidu.browser.inter':     'browser',
  // Messaging
  'com.android.mms':             'messaging',
  'org.telegram.messenger':      'messaging',
  'com.whatsapp':                'messaging',
  'com.discord':                 'messaging',
  // Utility
  'com.android.camera2':         'utility',
  'com.google.android.apps.maps': 'utility',
  'com.alipay.android.app':      'utility',  // Alipay
  'com.eg.android.AlipayGphone': 'utility',
  'com.taobao.taobao':           'utility',  // Taobao
  'com.jingdong.app.mall':       'utility',  // JD
  'com.meituan.android.pt':      'utility',  // Meituan
};

export function getCategory(packageName) {
  if (PKG_CATEGORY[packageName]) return PKG_CATEGORY[packageName];
  for (const [prefix, cat] of Object.entries(PKG_CATEGORY)) {
    if (packageName.startsWith(prefix + '.') || packageName.startsWith(prefix + ':')) {
      return cat;
    }
  }
  return 'unknown';
}

// ── Session reconstruction ────────────────────────────────────────────────────

/**
 * Convert raw FOREGROUND/BACKGROUND event chain into App sessions.
 */
export function buildSessionsFromTimeline(events) {
  if (!events || events.length === 0) return [];

  // Sort by timestamp ascending
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  const open     = {};   // packageName → startTs
  const sessions = [];

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const pkg = ev.packageName;
    const eventType = ev.eventType;
    const timestamp = ev.timestamp;

    if (!pkg) continue;

    if (eventType === 1) {
      // FOREGROUND
      if (open[pkg] !== undefined) {
        const dur = timestamp - open[pkg];
        if (dur >= 500) {
          sessions.push(_makeSession(pkg, open[pkg], timestamp, dur));
        }
      }
      open[pkg] = timestamp;

    } else if (eventType === 2) {
      // BACKGROUND
      if (open[pkg] !== undefined) {
        const dur = timestamp - open[pkg];
        if (dur >= 500) {
          sessions.push(_makeSession(pkg, open[pkg], timestamp, dur));
        }
        delete open[pkg];
      }
    }
  }

  // Close any sessions still open at query time
  const now = Date.now();
  for (const [pkg, startTs] of Object.entries(open)) {
    const dur = now - startTs;
    if (dur >= 500) {
      sessions.push(_makeSession(pkg, startTs, now, dur));
    }
  }

  return sessions.sort((a, b) => a.start_ts - b.start_ts);
}

function _makeSession(pkg, startTs, endTs, duration) {
  const d = new Date(startTs);
  return {
    packageName: pkg,
    category:    getCategory(pkg),
    start_ts:    startTs,
    end_ts:      endTs,
    duration,
    date: [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-'),
    hour: d.getHours(),
  };
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncUsageData(daysBack = 30) {
  if (isSyncing) {
    console.log('[UsageCollector] Database is busy, bypassing this concurrent request.');
    return 0;
  }

  isSyncing = true;

  try {
    const rawTimeline = await getTimelineLastDays(daysBack);
    
    if (!rawTimeline || rawTimeline.length === 0) {
      isSyncing = false;
      return 0;
    }

    const sessions = buildSessionsFromTimeline(rawTimeline);
    
    if (sessions.length > 0) {
      await upsertAppSessions(sessions);
    }
    
    console.log(`[UsageCollector] Synced ${sessions.length} sessions (${rawTimeline.length} raw events)`);
    return sessions.length;
  } catch (e) {
    console.warn('[UsageCollector] Sync failed:', e.message);
    return 0;
  } finally {
    isSyncing = false;
  }
}
