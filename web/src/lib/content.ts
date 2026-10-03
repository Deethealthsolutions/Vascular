// Prototype content. In production this comes from the headless CMS, with a
// named clinician reviewer and review date on every page (SPEC §4.1, §7.3).

export type Condition = {
  slug: string;
  name: string;
  summary: string;
  overview: string;
  warningSigns: string[];
  atRisk: string[];
  treatments: string[]; // treatment slugs
  urgent: string;
};

export type Treatment = {
  slug: string;
  name: string;
  summary: string;
  what: string;
  expect: string[];
  goodFor: string[]; // condition slugs
};

export const conditions: Condition[] = [
  {
    slug: "diabetic-foot-ulcers",
    name: "Diabetic foot ulcers",
    summary: "Open sores on the feet of people with diabetes. Early care prevents infection and amputation.",
    overview:
      "Diabetes can reduce feeling in the feet (neuropathy) and slow blood flow. A small blister or cut can go unnoticed and turn into a deep wound. With fast, coordinated care, most diabetic foot ulcers heal.",
    warningSigns: [
      "A sore, blister or crack on the foot that is not getting better",
      "Drainage on your sock",
      "Redness, warmth or swelling",
      "A bad smell from the wound",
      "Skin that turns dark or black",
    ],
    atRisk: ["People with diabetes, especially with neuropathy", "Past foot ulcer or amputation", "Poor circulation", "Foot deformities such as bunions or hammertoes"],
    treatments: ["advanced-wound-care", "offloading", "revascularization", "hbot"],
    urgent: "Fever, spreading redness or black skin on the foot are emergencies. Go to the emergency room or call 911.",
  },
  {
    slug: "peripheral-artery-disease",
    name: "Peripheral artery disease (PAD)",
    summary: "Narrowed arteries that reduce blood flow to the legs and feet.",
    overview:
      "Plaque builds up in the arteries of the legs, so less blood reaches the muscles and skin. PAD can cause pain when walking and makes wounds slow to heal. A simple, painless test called the ankle-brachial index (ABI) can detect it.",
    warningSigns: [
      "Cramping or pain in the calf, thigh or hip when walking that goes away with rest",
      "Cold feet or legs",
      "Weak or missing pulses in the feet",
      "Shiny skin or hair loss on the legs",
      "Toenails that grow slowly",
    ],
    atRisk: ["Smokers and former smokers", "People with diabetes", "Age over 65, or over 50 with risk factors", "High blood pressure or cholesterol", "Kidney disease"],
    treatments: ["revascularization", "advanced-wound-care"],
    urgent: "A leg that suddenly turns cold, pale, numb or very painful is an emergency. Call 911.",
  },
  {
    slug: "critical-limb-ischemia",
    name: "Chronic limb-threatening ischemia (CLTI)",
    summary: "The most severe form of PAD, with pain at rest or wounds that won't heal.",
    overview:
      "In CLTI, blood flow is so low that the foot hurts even at rest, often at night, or wounds cannot heal. Without treatment to restore blood flow, the risk of amputation is high. Restoring circulation is the key step in limb salvage.",
    warningSigns: [
      "Foot pain at night that improves when you hang your leg off the bed",
      "Wounds on the toes or heel that won't heal",
      "Dark or black skin on the toes",
    ],
    atRisk: ["People with PAD, diabetes or kidney failure", "Current smokers"],
    treatments: ["revascularization", "limb-salvage-surgery", "advanced-wound-care"],
    urgent: "Black toes, spreading infection or sudden severe pain need same-day care.",
  },
  {
    slug: "venous-leg-ulcers",
    name: "Venous leg ulcers",
    summary: "Wounds near the ankle caused by poor vein function.",
    overview:
      "When leg veins don't carry blood back to the heart well, pressure builds up and the skin can break down, usually above the inner ankle. Compression therapy and treating the underlying vein problem are central to healing and to keeping ulcers from coming back.",
    warningSigns: ["Leg swelling that worsens during the day", "Brown discoloration around the ankle", "Itchy, weeping skin", "A shallow wound above the ankle"],
    atRisk: ["Varicose veins", "Past blood clots in the leg", "Obesity", "Jobs that involve long periods of standing"],
    treatments: ["advanced-wound-care", "venous-procedures"],
    urgent: "Sudden leg swelling with pain, or shortness of breath, can mean a blood clot. Call 911.",
  },
  {
    slug: "radiation-tissue-injury",
    name: "Radiation tissue injury",
    summary: "Delayed damage to skin, bone or organs months to years after radiation therapy.",
    overview:
      "Radiation can permanently damage small blood vessels. Months or years later, tissue may break down, including jaw bone (osteoradionecrosis), bladder (radiation cystitis) or skin. Hyperbaric oxygen therapy is a recognized treatment for these injuries.",
    warningSigns: ["Wounds in a previously radiated area", "Exposed bone in the mouth after dental work", "Blood in the urine after pelvic radiation"],
    atRisk: ["Anyone who has had radiation therapy for cancer, especially head, neck or pelvis"],
    treatments: ["hbot", "advanced-wound-care"],
    urgent: "Heavy bleeding needs emergency care.",
  },
  {
    slug: "chronic-osteomyelitis",
    name: "Chronic bone infection (osteomyelitis)",
    summary: "Bone infection that keeps coming back despite treatment, often under a foot wound.",
    overview:
      "Bone infection is common under deep diabetic foot ulcers. Treatment combines antibiotics, surgery to remove infected bone, and sometimes hyperbaric oxygen therapy when infection doesn't respond to standard care.",
    warningSigns: ["A wound where you can feel or see bone", "Drainage that doesn't stop", "Swollen, red, warm toe or foot"],
    atRisk: ["Diabetic foot ulcers", "Past foot surgery or fractures"],
    treatments: ["limb-salvage-surgery", "hbot", "advanced-wound-care"],
    urgent: "Fever with a foot wound needs same-day care.",
  },
];

export const treatments: Treatment[] = [
  {
    slug: "revascularization",
    name: "Endovascular revascularization",
    summary: "Minimally invasive procedures to reopen blocked leg arteries: angioplasty, stenting and atherectomy.",
    what:
      "Through a small needle puncture, usually in the groin, a thin wire and catheter are guided to the blockage using X-ray imaging. A balloon (angioplasty), a metal mesh tube (stent) or a device that removes plaque (atherectomy) restores blood flow to the foot so wounds can heal.",
    expect: ["Usually an outpatient procedure", "Local anesthesia with light sedation", "Walking the same day or next day", "Follow-up ultrasound to check blood flow"],
    goodFor: ["peripheral-artery-disease", "critical-limb-ischemia", "diabetic-foot-ulcers"],
  },
  {
    slug: "advanced-wound-care",
    name: "Advanced wound care",
    summary: "Debridement, specialized dressings, negative pressure therapy and skin substitutes.",
    what:
      "Our wound team removes dead tissue (debridement), controls infection and moisture, and uses advanced therapies such as negative pressure wound therapy (a wound vac) and cellular or tissue-based skin substitutes when a wound stalls.",
    expect: ["Weekly visits with wound measurements and photos", "A home dressing plan you can manage", "Clear goals: we reassess if the wound hasn't shrunk about 50% in 4 weeks"],
    goodFor: ["diabetic-foot-ulcers", "venous-leg-ulcers", "critical-limb-ischemia", "chronic-osteomyelitis"],
  },
  {
    slug: "offloading",
    name: "Offloading & total contact casting",
    summary: "Taking pressure off a foot wound so it can heal, the most important step for diabetic foot ulcers.",
    what:
      "A wound that is walked on cannot heal. A total contact cast, removable walker boot or custom footwear spreads pressure away from the ulcer. After healing, custom shoes and insoles help keep new ulcers from forming.",
    expect: ["Cast changed weekly", "Instructions to limit walking", "Custom shoes after healing"],
    goodFor: ["diabetic-foot-ulcers"],
  },
  {
    slug: "hbot",
    name: "Hyperbaric oxygen therapy (HBOT)",
    summary: "Breathing 100% oxygen in a pressurized chamber to help hard-to-heal wounds.",
    what:
      "Inside a clear, comfortable chamber, you breathe pure oxygen at higher-than-normal pressure. This greatly increases oxygen in the blood and tissues, helping fight infection and grow new blood vessels. A typical course is 20–40 daily sessions of about 2 hours each.",
    expect: [
      "Ear fullness, like on an airplane. We teach you how to clear your ears.",
      "You can watch TV or rest during treatment",
      "If you have diabetes, we check your blood sugar before every session",
      "No lotions, hair products or electronics in the chamber",
    ],
    goodFor: ["diabetic-foot-ulcers", "radiation-tissue-injury", "chronic-osteomyelitis"],
  },
  {
    slug: "limb-salvage-surgery",
    name: "Limb salvage surgery",
    summary: "Surgical bypass, infected bone removal and foot reconstruction to avoid major amputation.",
    what:
      "When minimally invasive options are not enough, surgeons can bypass blocked arteries using a vein or graft, remove infected bone, or perform partial foot procedures that keep the foot functional. A team of vascular, podiatric and wound specialists decides together.",
    expect: ["Hospital stay of several days for bypass surgery", "Coordinated wound care after surgery", "Physical therapy and custom footwear"],
    goodFor: ["critical-limb-ischemia", "chronic-osteomyelitis", "diabetic-foot-ulcers"],
  },
  {
    slug: "venous-procedures",
    name: "Venous procedures",
    summary: "Compression therapy and minimally invasive vein closure to heal and prevent venous ulcers.",
    what:
      "Compression wraps or stockings reduce swelling and pressure. If ultrasound shows faulty veins, they can be closed with heat (ablation) or medical adhesive through a small needle puncture, lowering the chance of ulcers returning.",
    expect: ["Duplex ultrasound to map your veins", "In-office procedure, walk out the same day", "Continued compression afterward"],
    goodFor: ["venous-leg-ulcers"],
  },
];

export const getCondition = (slug: string) => conditions.find((c) => c.slug === slug);
export const getTreatment = (slug: string) => treatments.find((t) => t.slug === slug);

// Placeholder outcomes — replace with the practice's audited data (SPEC §4.6).
export const outcomes = {
  period: "Jan–Jun 2026 (illustrative data)",
  metrics: [
    { label: "Wounds healed by 20 weeks", value: 78, unit: "%" },
    { label: "Limb salvage rate (no major amputation at 1 year)", value: 91, unit: "%" },
    { label: "HBOT series completed", value: 84, unit: "%" },
    { label: "Patients who would recommend us", value: 96, unit: "%" },
  ],
  medianDaysToHeal: 49,
  urgentReferralToVisitHours: 52,
};
