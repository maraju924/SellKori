export const PAGE_SUBSCRIBE_FIELDS = [
  'messages',
  'messaging_postbacks',
  'messaging_optins',
  'messaging_referrals',
  'feed',
];

export const MANUAL_SUBSCRIBE_HINT =
  'টোকেন বৈধ! তবে টোকেনে pages_manage_metadata পারমিশন না থাকায় অটো-সাবস্ক্রাইব করা যায়নি, অথবা feed সাবস্ক্রিপশন নেই। একবার ম্যানুয়ালি করে দিন: developers.facebook.com → আপনার অ্যাপ → Messenger → Messenger API Settings → Webhooks অংশে আপনার পেজের পাশে "Add subscriptions" চেপে messages, messaging_postbacks এবং feed টিক দিন। কমেন্টে রিপ্লাই ও ইনবক্স মেসেজের জন্য feed আবশ্যক।';

export function pageSubscriptionsIncludeField(subscriptions: any, field: string): boolean {
  const want = String(field || '').trim().toLowerCase();
  const rows = Array.isArray(subscriptions?.data) ? subscriptions.data : [];
  return rows.some((row: any) => {
    const fields = row?.subscribed_fields || row?.subscribedFields || [];
    return Array.isArray(fields) && fields.some((item: unknown) => String(item || '').trim().toLowerCase() === want);
  });
}

export function evaluateSubscriptionState(input: {
  autoSubscribeOk: boolean;
  subscribeError: string;
  subscriptions: any;
}): { subscribed: boolean; subscribeError: string; needsManualSubscribe: boolean; hasFeed: boolean } {
  let subscribed = input.autoSubscribeOk;
  let subscribeError = input.subscribeError;
  if (!subscribed && Array.isArray(input.subscriptions?.data) && input.subscriptions.data.length > 0) {
    subscribed = true;
    subscribeError = '';
  }
  const hasFeed = input.autoSubscribeOk || pageSubscriptionsIncludeField(input.subscriptions, 'feed');
  const needsManualSubscribe = (!subscribed && /pages_manage_metadata|\(#200\)|\(#10\)|permission/i.test(subscribeError))
    || (subscribed && !hasFeed);
  return {
    subscribed,
    subscribeError: subscribed ? '' : subscribeError,
    needsManualSubscribe,
    hasFeed,
  };
}

export function facebookErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

async function graphJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal || AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `Facebook HTTP ${res.status}`);
    err.response = { data };
    throw err;
  }
  return data;
}

export async function subscribePageToMessenger(pageAccessToken: string) {
  const cleanToken = String(pageAccessToken || '').trim();
  const fields = PAGE_SUBSCRIBE_FIELDS.join(',');
  const encoded = encodeURIComponent(cleanToken);
  const page = await graphJson(
    `https://graph.facebook.com/v21.0/me?fields=${encodeURIComponent('id,name,category,link')}&access_token=${encoded}`
  );

  const pageId = String(page?.id || '').trim();
  let autoSubscribeOk = false;
  let subscribeError = '';
  const attempts = [
    () => graphJson(`https://graph.facebook.com/v21.0/me/subscribed_apps?access_token=${encoded}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscribed_fields: fields }),
    }),
    () => graphJson(
      `https://graph.facebook.com/v21.0/me/subscribed_apps?access_token=${encoded}&subscribed_fields=${encodeURIComponent(fields)}`,
      { method: 'POST' }
    ),
  ];
  if (pageId) {
    attempts.push(() => graphJson(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/subscribed_apps?access_token=${encoded}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed_fields: fields }),
      }
    ));
  }

  for (const attempt of attempts) {
    try {
      await attempt();
      autoSubscribeOk = true;
      subscribeError = '';
      break;
    } catch (err: any) {
      subscribeError = facebookErrorMessage(err, 'subscribe failed');
    }
  }

  let subscriptions: any = null;
  try {
    subscriptions = await graphJson(
      `https://graph.facebook.com/v21.0/me/subscribed_apps?access_token=${encoded}`
    );
  } catch {
    // listing subscriptions is optional
  }

  const state = evaluateSubscriptionState({
    autoSubscribeOk,
    subscribeError,
    subscriptions,
  });

  return {
    page,
    subscriptions,
    ...state,
  };
}

export function tokenSuccessPayload(result: Awaited<ReturnType<typeof subscribePageToMessenger>>) {
  return {
    success: true,
    page: result.page,
    subscribed: result.subscribed,
    subscribeError: result.subscribeError || undefined,
    subscriptions: result.subscriptions,
    subscribeFields: PAGE_SUBSCRIBE_FIELDS,
    needsManualSubscribe: result.needsManualSubscribe || undefined,
    manualSubscribeHint: result.needsManualSubscribe ? MANUAL_SUBSCRIBE_HINT : undefined,
  };
}
