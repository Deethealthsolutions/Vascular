// Placeholder practice details — replace with the real practice's information.
export const site = {
  name: "Northbridge Wound & Vascular Center",
  shortName: "Northbridge",
  tagline: "Healing wounds. Restoring circulation. Saving limbs.",
  phone: "(555) 010-2400",
  referralFax: "(555) 010-2401",
  email: "care@example.com",
  locations: [
    {
      id: "main",
      name: "Main Campus",
      address: "1200 Example Avenue, Suite 300",
      city: "Springfield, ST 00000",
      hours: "Mon–Fri 7:30am–5:30pm",
      services: ["Wound clinic", "Vascular lab", "Hyperbaric chambers (3)", "Cath/angio suite"],
    },
    {
      id: "east",
      name: "East Clinic",
      address: "45 Sample Road",
      city: "Springfield, ST 00000",
      hours: "Mon–Thu 8:00am–4:30pm",
      services: ["Wound clinic", "Diabetic foot clinic", "Vascular lab"],
    },
  ],
  insurance: ["Medicare", "Medicaid", "Aetna", "Blue Cross Blue Shield", "Cigna", "Humana", "UnitedHealthcare", "Tricare"],
} as const;

export const nav = [
  { href: "/conditions", label: "Conditions" },
  { href: "/treatments", label: "Treatments" },
  { href: "/self-check", label: "Self-check" },
  { href: "/outcomes", label: "Our results" },
  { href: "/refer", label: "For providers" },
] as const;

export const team = [
  { name: "Dr. A. Rivera, MD", role: "Vascular & Endovascular Surgeon", focus: "Limb salvage, CLTI revascularization" },
  { name: "Dr. J. Okafor, DPM", role: "Podiatric Surgeon", focus: "Diabetic foot reconstruction, offloading" },
  { name: "Dr. M. Chen, MD", role: "Wound & Hyperbaric Medicine", focus: "HBOT, radiation injury, complex wounds" },
  { name: "S. Patel, APRN, CWON", role: "Wound Care Nurse Practitioner", focus: "Advanced dressings, venous ulcers" },
] as const;
