import { h, p, pages, t, type EvalReport } from "./build";

/**
 * Reports written by hand for the eval. They're all made up; no real patient
 * appears in them. Each tests a different shape: US lab panels with flags, a
 * lipid and thyroid panel, SI units with no printed ranges and two result
 * dates, radiology prose, and a discharge summary that mixes results with
 * vitals and medication doses.
 */

const cbcBmp: EvalReport = {
  id: "cbc-bmp",
  title: "Outpatient CBC and basic metabolic panel",
  document: pages(
    [
      h("RIVERSIDE LABORATORY SERVICES", 1),
      t(
        ["Patient", "Doe, Jane", "DOB", "04/12/1968"],
        ["MRN", "00482913", "Collected", "03-Mar-2026 08:15"],
        ["Ordering provider", "Dr. A. Patel", "Phone", "555-201-3344"],
      ),
      h("COMPLETE BLOOD COUNT"),
      t(
        ["Test", "Result", "Flag", "Reference Range", "Units"],
        ["WBC", "12.4", "H", "4.0-11.0", "x10^9/L"],
        ["RBC", "4.52", "", "4.20-5.80", "x10^12/L"],
        ["Hemoglobin", "11.2", "L", "13.0-17.0", "g/dL"],
        ["Hematocrit", "34.1", "L", "38.0-50.0", "%"],
        ["MCV", "75", "L", "80-100", "fL"],
        ["Platelets", "312", "", "150-400", "x10^9/L"],
      ),
    ],
    [
      h("BASIC METABOLIC PANEL"),
      t(
        ["Test", "Result", "Flag", "Reference Range", "Units"],
        ["Glucose", "128", "H", "70-99", "mg/dL"],
        ["BUN", "18", "", "7-25", "mg/dL"],
        ["Creatinine", "1.42", "H", "0.60-1.30", "mg/dL"],
        ["eGFR", "52", "L", ">=60", "mL/min/1.73m2"],
        ["Sodium", "139", "", "135-146", "mmol/L"],
        ["Potassium", "5.4", "H", "3.5-5.3", "mmol/L"],
        ["Chloride", "101", "", "98-110", "mmol/L"],
        ["CO2", "24", "", "20-32", "mmol/L"],
        ["Calcium", "9.6", "", "8.6-10.3", "mg/dL"],
      ),
      h("COMMENTS"),
      p(
        "Hemoglobin and MCV are low, consistent with a microcytic pattern. Suggest iron studies. Creatinine is mildly elevated with a reduced eGFR; recommend a repeat basic metabolic panel in 4 weeks and a review of medications that affect the kidneys.",
      ),
    ],
  ),
  questions: [
    {
      question: "What was my potassium level?",
      kind: "lexical",
      relevant: ["Potassium"],
    },
    { question: "What is my eGFR?", kind: "lexical", relevant: ["eGFR"] },
    {
      question: "How many platelets do I have?",
      kind: "lexical",
      relevant: ["Platelets"],
    },
    {
      question: "Are my kidneys working properly?",
      kind: "paraphrase",
      relevant: ["Creatinine", "eGFR"],
    },
    {
      question: "Do I have an infection?",
      kind: "paraphrase",
      relevant: ["WBC"],
    },
    {
      question: "Am I anemic?",
      kind: "paraphrase",
      relevant: ["Hemoglobin", "microcytic"],
    },
    {
      question: "What is my blood sugar?",
      kind: "paraphrase",
      relevant: ["Glucose"],
    },
    {
      question: "What does the lab suggest I do next?",
      kind: "section",
      relevant: ["Suggest iron studies"],
    },
  ],
  labs: [
    { name: "WBC", value: 12.4, status: "high" },
    { name: "RBC", value: 4.52, status: "normal" },
    { name: "Hemoglobin", value: 11.2, status: "low" },
    { name: "Hematocrit", value: 34.1, status: "low" },
    { name: "MCV", value: 75, status: "low" },
    { name: "Platelets", value: 312, status: "normal" },
    { name: "Glucose", value: 128, status: "high" },
    { name: "BUN", value: 18, status: "normal" },
    { name: "Creatinine", value: 1.42, status: "high" },
    { name: "eGFR", value: 52, status: "low" },
    { name: "Sodium", value: 139, status: "normal" },
    { name: "Potassium", value: 5.4, status: "high" },
    { name: "Chloride", value: 101, status: "normal" },
    { name: "CO2", value: 24, status: "normal" },
    { name: "Calcium", value: 9.6, status: "normal" },
  ],
};

const lipidThyroid: EvalReport = {
  id: "lipid-thyroid",
  title: "Annual physical: lipids, diabetes screen, thyroid",
  document: pages(
    [
      h("LIPID PANEL"),
      t(
        ["Test", "Result", "Flag", "Reference Range", "Units"],
        ["Total Cholesterol", "232", "H", "<200", "mg/dL"],
        ["HDL Cholesterol", "38", "L", ">39", "mg/dL"],
        ["Triglycerides", "180", "H", "<150", "mg/dL"],
        ["LDL Cholesterol (calc)", "158", "H", "<100", "mg/dL"],
        ["Non-HDL Cholesterol", "194", "H", "<130", "mg/dL"],
      ),
      p(
        "LDL goals depend on overall cardiovascular risk. Discuss treatment targets with your provider.",
      ),
      h("DIABETES SCREENING"),
      t(
        ["Test", "Result", "Flag", "Reference Range", "Units"],
        ["Hemoglobin A1c", "6.1", "H", "<5.7", "%"],
        ["Glucose, fasting", "104", "H", "65-99", "mg/dL"],
      ),
      p(
        "A hemoglobin A1c between 5.7% and 6.4% is consistent with prediabetes, meaning an increased risk of developing diabetes.",
      ),
    ],
    [
      h("THYROID AND VITAMINS"),
      t(
        ["Test", "Result", "Flag", "Reference Range", "Units"],
        ["TSH", "2.10", "", "0.40-4.50", "mIU/L"],
        ["Free T4", "1.2", "", "0.8-1.8", "ng/dL"],
        ["Vitamin D, 25-OH", "22", "L", "30-100", "ng/mL"],
      ),
      p(
        "Vitamin D insufficiency is common in winter months. Supplementation may be considered.",
      ),
    ],
  ),
  questions: [
    {
      question: "Is my cholesterol high?",
      kind: "lexical",
      relevant: ["Total Cholesterol"],
    },
    {
      question: "What are my triglycerides?",
      kind: "lexical",
      relevant: ["Triglycerides"],
    },
    { question: "How is my thyroid?", kind: "lexical", relevant: ["TSH"] },
    {
      question: "What is my good cholesterol?",
      kind: "paraphrase",
      relevant: ["HDL"],
    },
    {
      question: "Do I have diabetes?",
      kind: "paraphrase",
      relevant: ["A1c", "prediabetes"],
    },
    {
      question: "What is my average blood sugar over the last few months?",
      kind: "paraphrase",
      relevant: ["A1c"],
    },
    {
      question: "Am I low on the sunshine vitamin?",
      kind: "paraphrase",
      relevant: ["Vitamin D"],
    },
  ],
  labs: [
    { name: "Total Cholesterol", value: 232, status: "high" },
    { name: "HDL Cholesterol", value: 38, status: "low" },
    { name: "Triglycerides", value: 180, status: "high" },
    { name: "LDL Cholesterol (calc)", value: 158, status: "high" },
    { name: "Non-HDL Cholesterol", value: 194, status: "high" },
    { name: "Hemoglobin A1c", value: 6.1, status: "high" },
    { name: "Glucose, fasting", value: 104, status: "high" },
    { name: "TSH", value: 2.1, status: "normal" },
    { name: "Free T4", value: 1.2, status: "normal" },
    { name: "Vitamin D, 25-OH", value: 22, status: "low" },
  ],
};

const ctAbdomen: EvalReport = {
  id: "ct-abdomen",
  title: "CT abdomen and pelvis with contrast",
  document: pages(
    [
      h("CT ABDOMEN AND PELVIS WITH IV CONTRAST", 1),
      h("CLINICAL HISTORY"),
      p("Right lower quadrant pain and fever for two days."),
      h("TECHNIQUE"),
      p(
        "Axial images were obtained from the lung bases through the pubic symphysis after intravenous contrast. Coronal and sagittal reformats were reviewed.",
      ),
      h("COMPARISON"),
      p("None available."),
      h("FINDINGS"),
      h("Liver", 3),
      p("Normal in size and attenuation. No focal lesion."),
      h("Gallbladder", 3),
      p(
        "Several small gallstones without gallbladder wall thickening or surrounding fluid.",
      ),
      h("Kidneys", 3),
      p("Both kidneys enhance symmetrically. No hydronephrosis or stones."),
    ],
    [
      h("Bowel", 3),
      p(
        "The appendix is dilated to 12 mm with periappendiceal fat stranding and a 6 mm appendicolith at its base. No abscess, fluid collection, or free intraperitoneal air.",
      ),
      h("Lymph nodes", 3),
      p("A few prominent mesenteric lymph nodes, likely reactive."),
      h("IMPRESSION"),
      p(
        "1. Acute uncomplicated appendicitis with an appendicolith. 2. Cholelithiasis without evidence of cholecystitis.",
      ),
    ],
  ),
  questions: [
    {
      question: "Do I have appendicitis?",
      kind: "lexical",
      relevant: ["appendicitis", "appendix is dilated"],
    },
    {
      question: "What is an appendicolith?",
      kind: "lexical",
      relevant: ["appendicolith"],
    },
    {
      question: "What did the scan find overall?",
      kind: "section",
      relevant: ["IMPRESSION"],
    },
    {
      question: "Why was this scan done?",
      kind: "section",
      relevant: ["Right lower quadrant pain"],
    },
    {
      question: "Is anything wrong with my gallbladder?",
      kind: "paraphrase",
      relevant: ["gallstones", "Cholelithiasis"],
    },
    {
      question: "Are my kidneys okay?",
      kind: "paraphrase",
      relevant: ["hydronephrosis"],
    },
    {
      question: "Did my intestine burst or leak?",
      kind: "paraphrase",
      relevant: ["free intraperitoneal air"],
    },
  ],
  labs: [],
};

const heartFailure: EvalReport = {
  id: "discharge-hf",
  title: "Discharge summary: heart failure",
  document: pages(
    [
      h("DISCHARGE SUMMARY", 1),
      h("DIAGNOSES"),
      p(
        "Acute on chronic heart failure with reduced ejection fraction. Hypokalemia, resolved.",
      ),
      h("HOSPITAL COURSE"),
      p(
        "Admitted with three days of worsening shortness of breath, orthopnea and leg swelling. BNP on arrival was 1,240 pg/mL. He was diuresed with intravenous furosemide with 4.2 kg of weight loss over four days.",
      ),
      p(
        "An echocardiogram showed a left ventricular ejection fraction of 30% with global hypokinesis. Potassium fell to 3.2 during diuresis and was replaced. Spironolactone was started before discharge.",
      ),
    ],
    [
      h("DISCHARGE MEDICATIONS"),
      t(
        ["Medication", "Dose", "Frequency", "Change"],
        ["Furosemide", "40 mg", "by mouth daily", "New"],
        ["Spironolactone", "25 mg", "by mouth daily", "New"],
        ["Metoprolol succinate", "50 mg", "by mouth daily", "Unchanged"],
        ["Lisinopril", "10 mg", "by mouth daily", "Unchanged"],
        ["Potassium chloride", "20 mEq", "daily", "Stopped"],
      ),
      h("DISCHARGE LABS"),
      t(
        ["Test", "Result", "Units"],
        ["Sodium", "136", "mmol/L"],
        ["Potassium", "4.1", "mmol/L"],
        ["Creatinine", "1.3", "mg/dL"],
        ["BNP", "480", "pg/mL"],
      ),
      h("VITAL SIGNS AT DISCHARGE"),
      t(
        ["Measure", "Value", "Units"],
        ["Blood pressure", "118/72", "mmHg"],
        ["Heart rate", "68", "bpm"],
        ["SpO2", "96", "%"],
        ["Weight", "82.4", "kg"],
      ),
      h("FOLLOW-UP INSTRUCTIONS"),
      p(
        "See cardiology within 1 week. Weigh yourself every morning and call if you gain more than 2 kg in 3 days. Limit salt to 2 g per day and fluids to 1.5 L per day.",
      ),
    ],
  ),
  questions: [
    {
      question: "What is my ejection fraction?",
      kind: "lexical",
      relevant: ["ejection fraction of 30%"],
    },
    { question: "What was my BNP?", kind: "lexical", relevant: ["BNP"] },
    {
      question: "Why was I in the hospital?",
      kind: "paraphrase",
      relevant: ["shortness of breath", "heart failure"],
    },
    {
      question: "How well is my heart pumping?",
      kind: "paraphrase",
      relevant: ["ejection fraction of 30%"],
    },
    {
      question: "What new medicines was I started on?",
      kind: "paraphrase",
      relevant: ["Spironolactone"],
    },
    {
      question: "How much salt am I allowed?",
      kind: "lexical",
      relevant: ["Limit salt"],
    },
    {
      question: "When should I call about my weight?",
      kind: "paraphrase",
      relevant: ["gain more than 2 kg"],
    },
    {
      question: "Why did I lose weight in the hospital?",
      kind: "paraphrase",
      relevant: ["4.2 kg"],
    },
  ],
  labs: [
    { name: "Sodium", value: 136, status: "normal" },
    { name: "Potassium", value: 4.1, status: "normal" },
    { name: "Creatinine", value: 1.3, status: "normal" },
    { name: "BNP", value: 480, status: "unknown" },
  ],
};

const liverSi: EvalReport = {
  id: "liver-si",
  title: "Liver follow-up in SI units, two dates, no printed ranges",
  document: pages([
    h("GASTROENTEROLOGY CLINIC RESULTS", 1),
    h("Chemistry"),
    t(
      ["Test", "12-Mar-2026", "19-Mar-2026", "Units"],
      ["ALT", "88", "64", "U/L"],
      ["AST", "61", "45", "U/L"],
      ["ALP", "140", "132", "U/L"],
      ["Bilirubin", "30", "22", "µmol/L"],
      ["Albumin", "33", "35", "g/L"],
      ["INR", "1.3", "1.2", ""],
    ),
    h("Hematology"),
    t(
      ["Test", "Result", "Units"],
      ["Hemoglobin", "128", "g/L"],
      ["Platelets", "142", "x10^9/L"],
    ),
    h("Imaging"),
    p(
      "Ultrasound shows a mildly echogenic liver in keeping with fatty infiltration. No biliary dilatation. Spleen measures 11 cm.",
    ),
    h("Plan"),
    p(
      "Liver enzymes are trending down. Continue alcohol abstinence, weight loss of 7 to 10 percent, and repeat liver tests in 3 months.",
    ),
  ]),
  questions: [
    { question: "Is my liver damaged?", kind: "paraphrase", relevant: ["ALT"] },
    {
      question: "Do I have a fatty liver?",
      kind: "lexical",
      relevant: ["fatty infiltration"],
    },
    {
      question: "How well does my blood clot?",
      kind: "paraphrase",
      relevant: ["INR"],
    },
    {
      question: "Is my bilirubin getting better?",
      kind: "lexical",
      relevant: ["Bilirubin"],
    },
    {
      question: "What should I do about my liver?",
      kind: "section",
      relevant: ["alcohol abstinence"],
    },
    {
      question: "Are my platelets normal?",
      kind: "lexical",
      relevant: ["Platelets"],
    },
  ],
  labs: [
    { name: "ALT", value: 88, status: "high" },
    { name: "ALT", value: 64, status: "high" },
    { name: "AST", value: 61, status: "high" },
    { name: "AST", value: 45, status: "high" },
    { name: "ALP", value: 140, status: "normal" },
    { name: "ALP", value: 132, status: "normal" },
    { name: "Bilirubin", value: 30, status: "high" },
    { name: "Bilirubin", value: 22, status: "high" },
    { name: "Albumin", value: 33, status: "low" },
    { name: "Albumin", value: 35, status: "normal" },
    { name: "INR", value: 1.3, status: "high" },
    { name: "INR", value: 1.2, status: "normal" },
    { name: "Hemoglobin", value: 128, status: "normal" },
    { name: "Platelets", value: 142, status: "low" },
  ],
};

const mriSpine: EvalReport = {
  id: "mri-spine",
  title: "MRI lumbar spine without contrast",
  document: pages([
    h("MRI LUMBAR SPINE WITHOUT CONTRAST", 1),
    h("INDICATION"),
    p("Low back pain radiating down the right leg for six weeks."),
    h("FINDINGS"),
    p(
      "Vertebral body heights and alignment are maintained. The conus ends normally at L1.",
    ),
    p("L3-L4: Mild disc desiccation without canal or foraminal stenosis."),
    p(
      "L4-L5: Broad-based disc bulge with a small right paracentral protrusion, moderately narrowing the right lateral recess and contacting the traversing right L5 nerve root.",
    ),
    p("L5-S1: Mild bilateral facet arthropathy. No nerve root compression."),
    h("IMPRESSION"),
    p(
      "Right paracentral disc protrusion at L4-L5 contacting the right L5 nerve root, which may explain the right leg symptoms. Mild degenerative changes elsewhere.",
    ),
  ]),
  questions: [
    {
      question: "Is a nerve being pinched?",
      kind: "paraphrase",
      relevant: [
        "contacting the traversing right L5 nerve root",
        "contacting the right L5 nerve root",
      ],
    },
    {
      question: "What is causing my leg pain?",
      kind: "paraphrase",
      relevant: ["right leg symptoms"],
    },
    {
      question: "What is facet arthropathy?",
      kind: "lexical",
      relevant: ["facet arthropathy"],
    },
    {
      question: "Which level is the worst?",
      kind: "section",
      relevant: ["L4-L5: Broad-based", "protrusion at L4-L5"],
    },
    {
      question: "Do I have a slipped disc?",
      kind: "paraphrase",
      relevant: ["protrusion"],
    },
  ],
  labs: [],
};

export const REPORTS: readonly EvalReport[] = [
  cbcBmp,
  lipidThyroid,
  ctAbdomen,
  heartFailure,
  liverSi,
  mriSpine,
];
