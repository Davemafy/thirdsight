export const VENDOR_INTELLIGENCE_VERSION = "vendor-intelligence-v1" as const;
export const VENDOR_INTELLIGENCE_REVIEWED_AT = "2026-09-20" as const;

export type VendorCategory =
  | "TAG_MANAGEMENT"
  | "ANALYTICS"
  | "AD_MEASUREMENT"
  | "CONSENT_MANAGEMENT"
  | "PERFORMANCE_ANALYTICS"
  | "ASSET_DELIVERY"
  | "PAYMENTS";

export interface VendorDocumentationSource {
  title: string;
  url: string;
  publisher: string;
  reviewedAt: string;
  sourceType: "VENDOR_DOCUMENTATION";
}

export interface VendorDomainMatcher {
  type: "EXACT" | "SUFFIX";
  value: string;
}

export interface VendorIntelligenceProfile {
  id: string;
  vendor: string;
  family: string;
  category: VendorCategory;
  matchers: readonly VendorDomainMatcher[];
  expectedPurposes: readonly string[];
  documentedCapabilities: readonly string[];
  documentedDataOrEvents: readonly string[];
  sources: readonly VendorDocumentationSource[];
  limitations: readonly string[];
}

export interface ResolvedVendorProfile {
  profileId: string;
  vendor: string;
  family: string;
  category: VendorCategory;
  expectedPurposes: readonly string[];
  documentedCapabilities: readonly string[];
  documentedDataOrEvents: readonly string[];
  sources: readonly VendorDocumentationSource[];
  limitations: readonly string[];
  matchedOrigins: readonly string[];
}

export interface VendorIntelligenceResolution {
  registryVersion: typeof VENDOR_INTELLIGENCE_VERSION;
  status: "MATCHED" | "MULTIPLE" | "UNRESOLVED";
  profiles: readonly ResolvedVendorProfile[];
  unresolvedOrigins: readonly string[];
  authorityBoundary: string;
}

const reviewedAt = VENDOR_INTELLIGENCE_REVIEWED_AT;
const source = (publisher:string,title:string,url:string):VendorDocumentationSource=>({
  publisher,
  title,
  url,
  reviewedAt,
  sourceType:"VENDOR_DOCUMENTATION",
});

export const VENDOR_INTELLIGENCE_PROFILES: readonly VendorIntelligenceProfile[] = [
  {
    id:"google-tagging",
    vendor:"Google",
    family:"Google tag / Tag Manager",
    category:"TAG_MANAGEMENT",
    matchers:[
      {type:"EXACT",value:"googletagmanager.com"},
      {type:"EXACT",value:"www.googletagmanager.com"},
    ],
    expectedPurposes:[
      "Deploy and fire measurement, marketing, analytics or support tags according to configured triggers.",
      "Send website measurement data to configured Google or third-party destinations.",
    ],
    documentedCapabilities:[
      "Fire tags on configured events such as page loads, clicks and form submissions.",
      "Read values exposed through the data layer, variables, first-party cookies or the DOM when configured to do so.",
      "Send measurement information from the site to configured tag destinations.",
    ],
    documentedDataOrEvents:[
      "Page loads",
      "Clicks",
      "Form submissions",
      "Configured data-layer values",
    ],
    sources:[
      source("Google","Components of Google Tag Manager","https://support.google.com/tagmanager/answer/6103657?hl=en"),
      source("Google","About the Google tag","https://support.google.com/tagmanager/answer/11994839?hl=en"),
    ],
    limitations:[
      "The googletagmanager.com hostname identifies Google tagging infrastructure, not the exact tags configured inside a merchant container.",
      "Vendor documentation describes available product behavior, not what a specific merchant approved or enabled.",
    ],
  },
  {
    id:"google-analytics",
    vendor:"Google",
    family:"Google Analytics",
    category:"ANALYTICS",
    matchers:[
      {type:"EXACT",value:"google-analytics.com"},
      {type:"SUFFIX",value:"google-analytics.com"},
      {type:"EXACT",value:"analytics.google.com"},
    ],
    expectedPurposes:[
      "Measure website usage and analytics events.",
    ],
    documentedCapabilities:[
      "Receive automatically collected and enhanced-measurement events through the Google tag.",
      "Measure page views, clicks, scrolls and configured events.",
      "Use browser cookies as part of configured web measurement.",
    ],
    documentedDataOrEvents:[
      "Page views",
      "Clicks",
      "Scrolls",
      "Configured analytics events",
    ],
    sources:[
      source("Google","Set up Google Analytics in Tag Manager","https://support.google.com/tagmanager/answer/9442095?hl=en"),
      source("Google","About the Google tag","https://support.google.com/tagmanager/answer/11994839?hl=en"),
    ],
    limitations:[
      "A Google Analytics origin does not reveal the merchant's property configuration, consent state or complete event schema.",
    ],
  },
  {
    id:"google-ads-measurement",
    vendor:"Google",
    family:"Google Ads / ad measurement",
    category:"AD_MEASUREMENT",
    matchers:[
      {type:"EXACT",value:"ad.doubleclick.net"},
      {type:"EXACT",value:"googleads.g.doubleclick.net"},
      {type:"EXACT",value:"stats.g.doubleclick.net"},
      {type:"EXACT",value:"www.googleadservices.com"},
      {type:"EXACT",value:"adservice.google.com"},
    ],
    expectedPurposes:[
      "Advertising measurement and website conversion tracking.",
    ],
    documentedCapabilities:[
      "Associate ad interactions with later website conversions when configured.",
      "Fire conversion events for configured page loads, clicks or business actions.",
      "Use click identifiers and first-party cookies for conversion measurement when configured.",
    ],
    documentedDataOrEvents:[
      "Ad interactions",
      "Conversion events",
      "Configured click or page-load conversions",
      "Click identifiers",
    ],
    sources:[
      source("Google","How Google Ads tracks website conversions","https://support.google.com/google-ads/answer/7521212?hl=en"),
      source("Google","Set up your Google tag across your Google accounts","https://support.google.com/google-ads/answer/12002338?hl=en"),
    ],
    limitations:[
      "DoubleClick-family origins cover several Google advertising products; hostname recognition does not prove the exact campaign, conversion action or merchant configuration.",
    ],
  },
  {
    id:"google-publisher-tag",
    vendor:"Google",
    family:"Google Publisher Tag / Ad Manager",
    category:"AD_MEASUREMENT",
    matchers:[
      {type:"EXACT",value:"securepubads.g.doubleclick.net"},
      {type:"EXACT",value:"pagead2.googlesyndication.com"},
    ],
    expectedPurposes:[
      "Define publisher ad inventory, request ads and render matching demand through Google Ad Manager.",
    ],
    documentedCapabilities:[
      "Define ad slots and page-level targeting settings.",
      "Initiate and bundle ad requests and render returned creatives.",
      "Pass configured ad-unit, size and key-value information to the ad server.",
      "Integrate consent and privacy settings for ad requests.",
    ],
    documentedDataOrEvents:[
      "Ad unit identifiers",
      "Ad sizes",
      "Configured targeting key-values",
      "Ad request and rendering state",
    ],
    sources:[
      source("Google","Overview of Google Publisher Tag","https://support.google.com/admanager/answer/181073?hl=en"),
      source("Google","Get Started with Google Publisher Tag","https://developers.google.com/publisher-tag/guides/get-started"),
    ],
    limitations:[
      "A Publisher Tag hostname does not reveal the publisher's inventory, targeting configuration, creative payloads or whether ads are personalized.",
    ],
  },
  {
    id:"google-fonts",
    vendor:"Google",
    family:"Google Fonts",
    category:"ASSET_DELIVERY",
    matchers:[
      {type:"EXACT",value:"fonts.googleapis.com"},
      {type:"EXACT",value:"fonts.gstatic.com"},
    ],
    expectedPurposes:[
      "Deliver web-font stylesheets and font files for page rendering.",
    ],
    documentedCapabilities:[
      "Serve CSS stylesheets for requested font families, styles and weights.",
      "Serve browser-appropriate font files referenced by the stylesheet.",
    ],
    documentedDataOrEvents:[
      "Font family/style requests",
      "Stylesheet delivery",
      "Font-file delivery",
    ],
    sources:[
      source("Google","Get Started with the Google Fonts API","https://developers.google.com/fonts/docs/getting_started"),
      source("Google","Google Fonts technical considerations","https://developers.google.com/fonts/docs/technical_considerations"),
    ],
    limitations:[
      "This profile describes documented font delivery behavior and should not be treated as analytics or advertising merely because the request is cross-origin.",
    ],
  },
  {
    id:"meta-browser-measurement",
    vendor:"Meta",
    family:"Meta browser measurement family",
    category:"AD_MEASUREMENT",
    matchers:[
      {type:"EXACT",value:"connect.facebook.net"},
    ],
    expectedPurposes:[
      "Load Meta browser-side integration code used for advertising measurement and conversion signaling.",
    ],
    documentedCapabilities:[
      "Support browser-side event or conversion signals used to measure advertising outcomes.",
    ],
    documentedDataOrEvents:[
      "Configured browser events",
      "Conversion signals",
    ],
    sources:[
      source("Meta","Meta Pixel developer documentation","https://developers.facebook.com/docs/meta-pixel/"),
      source("Meta","Ensuring More Quality Outcomes","https://www.facebook.com/audiencenetwork/news-and-insights/ensuring-more-quality-outcomes"),
    ],
    limitations:[
      "connect.facebook.net can host broader Meta browser SDK assets; hostname recognition alone does not prove that a specific request is Meta Pixel or reveal its configured event fields.",
      "ThirdSight does not treat Meta documentation as merchant authorization.",
    ],
  },
  {
    id:"onetrust-web-cmp",
    vendor:"OneTrust",
    family:"OneTrust Web CMP",
    category:"CONSENT_MANAGEMENT",
    matchers:[
      {type:"EXACT",value:"cdn.cookielaw.org"},
      {type:"EXACT",value:"geolocation.onetrust.com"},
      {type:"SUFFIX",value:"onetrust.com"},
    ],
    expectedPurposes:[
      "Manage consent, preferences and vendor/category controls on websites.",
    ],
    documentedCapabilities:[
      "Allow or reject consent categories, purposes, hosts and vendors.",
      "Render and update consent or preference-center UI.",
      "Use geolocation rules and expose methods for consent state and data-subject identifiers.",
    ],
    documentedDataOrEvents:[
      "Consent categories",
      "Vendor/host consent state",
      "Geolocation rule context",
      "Optional data-subject identifier",
    ],
    sources:[
      source("OneTrust","Web CMP JavaScript Methods","https://developer.onetrust.com/onetrust/docs/javascript-api"),
    ],
    limitations:[
      "The presence of OneTrust infrastructure does not reveal the merchant's configured consent model or prove that downstream tags respected it.",
    ],
  },
  {
    id:"microsoft-clarity",
    vendor:"Microsoft",
    family:"Microsoft Clarity",
    category:"ANALYTICS",
    matchers:[
      {type:"EXACT",value:"clarity.ms"},
      {type:"SUFFIX",value:"clarity.ms"},
    ],
    expectedPurposes:[
      "Behavioral analytics for understanding website user experience.",
    ],
    documentedCapabilities:[
      "Collect interaction data for session recordings and analytics.",
      "Track clicks and scrolls used to generate heatmaps.",
      "Use cookies and pseudonymous identifiers to associate interaction data when configured.",
    ],
    documentedDataOrEvents:[
      "Page/session interaction data",
      "Clicks",
      "Scrolls",
      "Session identifiers when cookies are enabled",
    ],
    sources:[
      source("Microsoft","Setup Clarity","https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup"),
      source("Microsoft","Clarity heatmaps overview","https://learn.microsoft.com/en-us/clarity/heatmaps/heatmaps-overview"),
      source("Microsoft","Clarity cookies","https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-cookies"),
    ],
    limitations:[
      "Clarity documentation describes product capability; merchant-specific masking, consent and project settings remain separate evidence.",
    ],
  },
  {
    id:"cloudflare-web-analytics",
    vendor:"Cloudflare",
    family:"Cloudflare Web Analytics",
    category:"PERFORMANCE_ANALYTICS",
    matchers:[
      {type:"EXACT",value:"static.cloudflareinsights.com"},
      {type:"EXACT",value:"cloudflareinsights.com"},
      {type:"SUFFIX",value:"cloudflareinsights.com"},
    ],
    expectedPurposes:[
      "Privacy-focused website performance analytics and real-user monitoring.",
    ],
    documentedCapabilities:[
      "Collect page-load timing metrics from browser Performance APIs.",
      "Report Core Web Vitals and page-view performance through the Web Analytics beacon.",
      "Send beacon data on page lifecycle events and route changes.",
    ],
    documentedDataOrEvents:[
      "Navigation timing",
      "Core Web Vitals",
      "Page views",
      "Route-change performance",
    ],
    sources:[
      source("Cloudflare","Cloudflare Web Analytics","https://developers.cloudflare.com/web-analytics/about/"),
      source("Cloudflare","Web Analytics data origin and collection","https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/"),
    ],
    limitations:[
      "Cloudflare documents Web Analytics as client-side performance measurement; a script origin alone does not prove what other Cloudflare products a site uses.",
    ],
  },
  {
    id:"linkedin-insight-tag",
    vendor:"LinkedIn",
    family:"LinkedIn Insight Tag",
    category:"AD_MEASUREMENT",
    matchers:[
      {type:"EXACT",value:"snap.licdn.com"},
      {type:"EXACT",value:"px.ads.linkedin.com"},
    ],
    expectedPurposes:[
      "Advertising conversion tracking, campaign measurement and audience/retargeting workflows.",
    ],
    documentedCapabilities:[
      "Capture website page visits and configured calls-to-action for conversion tracking.",
      "Support conversion actions such as form submissions, sign-ups and purchases.",
    ],
    documentedDataOrEvents:[
      "Page visits",
      "Call-to-action clicks",
      "Configured conversion actions",
    ],
    sources:[
      source("LinkedIn","Conversion Tracking","https://business.linkedin.com/advertise/ads/conversion-tracking"),
    ],
    limitations:[
      "The Insight Tag's presence does not establish which conversions or audiences the merchant configured.",
    ],
  },
  {
    id:"adobe-data-collection",
    vendor:"Adobe",
    family:"Adobe Experience Platform Data Collection",
    category:"TAG_MANAGEMENT",
    matchers:[
      {type:"EXACT",value:"assets.adobedtm.com"},
      {type:"EXACT",value:"edge.adobedc.net"},
      {type:"SUFFIX",value:"edge.adobedc.net"},
    ],
    expectedPurposes:[
      "Collect customer-experience data and route it to configured Adobe or non-Adobe destinations.",
      "Deploy and manage analytics, marketing and advertising tags.",
    ],
    documentedCapabilities:[
      "Collect web event data through Web SDK or tag extensions.",
      "Map payloads to schemas and send them through Adobe Edge Network datastreams.",
      "Stream data to configured Adobe solutions and, with event forwarding, non-Adobe destinations.",
    ],
    documentedDataOrEvents:[
      "Web events",
      "Context data",
      "Configured XDM/data payload fields",
      "Identity signals when configured",
    ],
    sources:[
      source("Adobe","Data collection overview","https://experienceleague.adobe.com/en/docs/experience-platform/collection/home"),
      source("Adobe","Web SDK tag extension overview","https://experienceleague.adobe.com/en/docs/experience-platform/tags/extensions/client/web-sdk/overview"),
    ],
    limitations:[
      "Adobe's domain family spans multiple configurable products; the observed hostname does not reveal the merchant's schema, datastream or destination configuration.",
    ],
  },
  {
    id:"tiktok-pixel",
    vendor:"TikTok",
    family:"TikTok Pixel",
    category:"AD_MEASUREMENT",
    matchers:[
      {type:"EXACT",value:"analytics.tiktok.com"},
    ],
    expectedPurposes:[
      "Measure website traffic and advertising campaign performance and optimize campaigns.",
    ],
    documentedCapabilities:[
      "Share configured website events with TikTok through the browser.",
      "Measure customer-journey actions such as product views, add-to-cart and purchase when configured.",
      "Associate event timing and configured event parameters with measurement.",
    ],
    documentedDataOrEvents:[
      "Product/content views",
      "Add-to-cart",
      "Purchase",
      "Configured event parameters",
      "Event timestamp",
    ],
    sources:[
      source("TikTok","About TikTok Pixel","https://ads.tiktok.com/resources/help/article/tiktok-pixel?lang=en-GB"),
      source("TikTok","Add or Edit Events in Event Builder and Custom Code","https://ads.tiktok.com/help/article/how-to-add-or-edit-events-event-builder-and-custom-code?lang=en"),
    ],
    limitations:[
      "The analytics.tiktok.com origin does not reveal which standard/custom events or parameters the merchant enabled.",
    ],
  },
  {
    id:"cloudinary-web",
    vendor:"Cloudinary",
    family:"Cloudinary web delivery / upload",
    category:"ASSET_DELIVERY",
    matchers:[
      {type:"EXACT",value:"res.cloudinary.com"},
      {type:"EXACT",value:"api.cloudinary.com"},
    ],
    expectedPurposes:[
      "Deliver, transform and optionally upload image/video assets for web applications.",
    ],
    documentedCapabilities:[
      "Render and transform image/video assets through the JavaScript SDK.",
      "Upload files directly from the browser to configured Cloudinary upload endpoints.",
    ],
    documentedDataOrEvents:[
      "Image/video asset requests",
      "Configured file uploads",
      "Asset transformation parameters",
    ],
    sources:[
      source("Cloudinary","JavaScript SDK","https://cloudinary.com/documentation/javascript_integration"),
      source("Cloudinary","JavaScript SDK image and video upload","https://cloudinary.com/documentation/javascript_image_and_video_upload"),
    ],
    limitations:[
      "Asset delivery is not evidence of analytics or customer-data collection. Upload capability depends on the merchant's implementation and presets.",
    ],
  },
  {
    id:"stripe-js",
    vendor:"Stripe",
    family:"Stripe.js / Elements",
    category:"PAYMENTS",
    matchers:[
      {type:"EXACT",value:"js.stripe.com"},
    ],
    expectedPurposes:[
      "Render secure web payment UI and collect payment details for Stripe payment flows.",
    ],
    documentedCapabilities:[
      "Render Payment Element and other payment UI in the browser.",
      "Collect and tokenize sensitive payment details inside Stripe Elements.",
      "Support multiple payment methods and payment-confirmation flows.",
    ],
    documentedDataOrEvents:[
      "Payment details entered into Stripe-hosted Elements",
      "Payment-method selection",
      "Payment confirmation state",
    ],
    sources:[
      source("Stripe","Stripe Web Elements","https://docs.stripe.com/payments/elements"),
      source("Stripe","Payment Element migration guide","https://docs.stripe.com/payments/payment-element/migration"),
    ],
    limitations:[
      "The presence of Stripe.js does not reveal which payment methods, customer fields or merchant-side Stripe APIs are configured.",
    ],
  },
] as const;

export function resolveVendorIntelligence(origins: readonly string[]): VendorIntelligenceResolution {
  const matches = new Map<string,{profile:VendorIntelligenceProfile;origins:Set<string>}>();
  const unresolvedOrigins:string[]=[];

  for(const origin of origins){
    const hostname=hostnameFromOrigin(origin);
    if(!hostname){
      unresolvedOrigins.push(origin);
      continue;
    }

    const profiles=VENDOR_INTELLIGENCE_PROFILES.filter((profile)=>
      profile.matchers.some((matcher)=>matchesHostname(hostname,matcher))
    );

    if(profiles.length===0){
      unresolvedOrigins.push(origin);
      continue;
    }

    for(const profile of profiles){
      const current=matches.get(profile.id)??{profile,origins:new Set<string>()};
      current.origins.add(origin);
      matches.set(profile.id,current);
    }
  }

  const profiles=[...matches.values()]
    .map(({profile,origins:matchedOrigins}):ResolvedVendorProfile=>({
      profileId:profile.id,
      vendor:profile.vendor,
      family:profile.family,
      category:profile.category,
      expectedPurposes:profile.expectedPurposes,
      documentedCapabilities:profile.documentedCapabilities,
      documentedDataOrEvents:profile.documentedDataOrEvents,
      sources:profile.sources,
      limitations:profile.limitations,
      matchedOrigins:[...matchedOrigins].sort(),
    }))
    .sort((a,b)=>a.vendor.localeCompare(b.vendor)||a.family.localeCompare(b.family));

  return {
    registryVersion:VENDOR_INTELLIGENCE_VERSION,
    status:profiles.length===0?"UNRESOLVED":profiles.length===1?"MATCHED":"MULTIPLE",
    profiles,
    unresolvedOrigins:[...new Set(unresolvedOrigins)].sort(),
    authorityBoundary:"Vendor documentation describes expected product purpose and documented capability. It does not establish merchant approval, merchant-specific configuration, runtime occurrence or enforcement authority.",
  };
}

export function resolveVendorOrigin(origin:string):VendorIntelligenceResolution{
  return resolveVendorIntelligence([origin]);
}

function matchesHostname(hostname:string,matcher:VendorDomainMatcher):boolean{
  const expected=matcher.value.toLowerCase();
  if(matcher.type==="EXACT") return hostname===expected;
  return hostname===expected||hostname.endsWith(`.${expected}`);
}

function hostnameFromOrigin(origin:string):string|null{
  try{return new URL(origin).hostname.toLowerCase();}catch{return null;}
}
