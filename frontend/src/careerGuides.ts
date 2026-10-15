// Editorial introductions, independent of the weekly vacancy snapshot.
export type GuideId = "data_analyst" | "frontend_developer" | "qa_engineer";
export type RouteView = "fields" | "learn" | "practice" | "next";
export type NextDecision = "continue" | "compare" | "repeat" | "";
export interface LocalizedText { en: string; ky: string }
const text = (en: string, ky: string): LocalizedText => ({ en, ky });

export const careerGuides = [
  {
    id: "data_analyst" as const, label: "Data Analyst",
    field: text("Data analysis", "Маалыматтарды талдоо"),
    summary: text("Use numbers to answer a practical question.", "Практикалык суроого сандар аркылуу жооп берүү."),
    description: text("A data analyst helps a team understand what is happening. They organise information, check it for mistakes and explain what the numbers show.", "Маалымат аналитиги командага эмне болуп жатканын түшүнүүгө жардам берет. Маалыматты иреттеп, каталарды текшерип, сандар эмнени көрсөтөрүн түшүндүрөт."),
    example: text("A café owner asks: ‘Which drink earned more money today?’ You check the sales, remove a repeated order and compare the totals.", "Кафенин ээси: «Бүгүн кайсы суусундуктан көбүрөөк акча түштү?» — деп сурайт. Сатууларды текшерип, кайталанган буйрутманы алып, суммаларды салыштырасыз."),
    daily: [
      text("Check a table for missing or repeated entries.", "Таблицада жетишпеген же кайталанган жазууларды текшерүү."),
      text("Calculate a total or compare two groups.", "Жалпы сумманы эсептөө же эки топту салыштыруу."),
      text("Explain the answer and what the data cannot tell you.", "Жоопту жана маалымат эмнени түшүндүрө албасын айтып берүү."),
    ],
    basics: text("Start with spreadsheets: tables, sums and simple charts. Later, SQL helps you find information in databases; Python can automate repeated work.", "Таблицалардан, суммалардан жана жөнөкөй диаграммалардан баштаңыз. Кийин SQL маалымат базасынан маалымат табууга, Python кайталанган иштерди автоматташтырууга жардам берет."),
    trial: text("Help a café check its sales", "Кафенин сатууларын текшериңиз"),
    outcome: text("Find a repeated order, then calculate the money earned from coffee and tea.", "Кайталанган буйрутманы таап, кофе менен чайдан түшкөн сумманы эсептеңиз."),
    next: text("Make a small table of something familiar, such as weekly expenses. Add the totals and explain one useful finding. Then practise sorting and filtering in a spreadsheet.", "Мисалы, апталык чыгымдар сыяктуу тааныш маалыматтан чакан таблица түзүңүз. Суммаларды кошуп, бир пайдалуу жыйынтыкты түшүндүрүңүз. Анан таблицаны сорттоону жана чыпкалоону машыгыңыз."),
    ai: text("AI can suggest a formula. Check the result against the original rows yourself: a confident explanation can still contain a counting mistake.", "AI формула сунуштай алат. Жыйынтыкты баштапкы саптар менен өзүңүз текшериңиз: ишенимдүү түшүндүрмөдө да эсептөө катасы болушу мүмкүн."),
    resource: { label: "Microsoft Learn · Data Analyst", url: "https://learn.microsoft.com/en-us/training/career-paths/data-analyst" },
  },
  {
    id: "frontend_developer" as const, label: "Frontend Developer",
    field: text("Web development", "Веб иштеп чыгуу"),
    summary: text("Build the pages people see and use.", "Адамдар көрүп, колдонгон баракчаларды түзүү."),
    description: text("A frontend developer builds the visible part of a website: its text, layout, buttons and forms. They make it usable on a phone, a computer and with a keyboard.", "Frontend иштеп чыгуучу сайттын көрүнгөн бөлүгүн: текстин, жайгашуусун, баскычтарын жана формаларын түзөт. Аны телефондо, компьютерде жана клавиатура менен колдонууга ыңгайлаштырат."),
    example: text("A workshop needs a booking page. You add a clear heading and a button so visitors know what the workshop is and how to join.", "Мастер-класска катталуу баракчасы керек. Коноктор анын эмне экенин жана кантип кошулууну түшүнүшү үчүн так баш аталыш жана баскыч кошосуз."),
    daily: [
      text("Turn words and a design into a web page.", "Текст менен дизайнды веб-баракчага айландыруу."),
      text("Make buttons and forms respond correctly.", "Баскычтар менен формалардын туура иштөөсүн камсыздоо."),
      text("Check that the page is readable on different screens.", "Баракча ар башка экранда окулушун текшерүү."),
    ],
    basics: text("HTML describes the page content. CSS controls how it looks. JavaScript adds behaviour, such as opening a menu. Start with a little HTML before choosing a framework.", "HTML баракчанын мазмунун сүрөттөйт. CSS анын көрүнүшүн башкарат. JavaScript, мисалы, меню ачууну кошот. Фреймворк тандоодон мурда бир аз HTML үйрөнүңүз."),
    trial: text("Change your first web page", "Алгачкы веб-баракчаңызды өзгөртүңүз"),
    outcome: text("Edit two pieces of HTML and see the heading and button change in a live preview.", "HTML'деги эки текстти өзгөртүп, баш аталыш менен баскычтын өзгөрүшүн алдын ала көрүңүз."),
    next: text("Make a page about a hobby using a heading, a paragraph and a link. Then try CSS to change the text size and spacing. Use the MDN lesson below when a tag is unfamiliar.", "Хоббиңиз тууралуу баш аталышы, абзацы жана шилтемеси бар баракча түзүңүз. Анан CSS менен тексттин өлчөмүн жана аралыктарды өзгөртүңүз. Түшүнүксүз тег үчүн төмөнкү MDN сабагын колдонуңуз."),
    ai: text("AI can explain a line of HTML. Make one change at a time and check the preview so you can explain what each change does.", "AI HTML сабын түшүндүрө алат. Ар бир өзгөртүү эмнени кыларын түшүнүү үчүн бирден өзгөртүп, алдын ала көрүнүштү текшериңиз."),
    resource: { label: "MDN · Getting started with HTML", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Basic_HTML_syntax" },
  },
  {
    id: "qa_engineer" as const, label: "QA Engineer",
    field: text("Software testing", "Программаны сыноо"),
    summary: text("Check that an app does what it promises.", "Колдонмо убада кылганын аткарарын текшерүү."),
    description: text("A software tester checks how an app behaves against a written rule. When something goes wrong, they describe the steps so a developer can repeat and fix the problem. The field is often called QA, short for quality assurance.", "Программаны сыноочу колдонмонун иштөөсүн жазылган эреже менен салыштырат. Ката болсо, иштеп чыгуучу кайталап оңдой алышы үчүн кадамдарын сүрөттөйт. Бул багытты көбүнчө QA — сапатты камсыздоо — деп аташат."),
    example: text("A workshop says visitors must be at least 16. The booking form accepts someone aged 15. You show the team exactly how that happened.", "Мастер-класс 16 жаштагы же андан улуу адамдарга арналган. Бирок катталуу формасы 15 жашты кабыл алат. Командага бул кантип болгонун так көрсөтөсүз."),
    daily: [
      text("Read what a feature is supposed to do.", "Функция эмне кылышы керектигин окуу."),
      text("Try ordinary inputs and values close to a limit.", "Кадимки маалыматты жана чекке жакын маанилерди сыноо."),
      text("Describe what you expected and what actually happened.", "Эмне күткөнүңүздү жана чындап эмне болгонун сүрөттөө."),
    ],
    basics: text("Start by following a rule carefully and describing a problem clearly. You can try manual testing without code. Later, some testers write code to repeat checks automatically.", "Адегенде эрежени так аткарып, көйгөйдү түшүнүктүү сүрөттөөнү үйрөнүңүз. Кол менен сыноону кодсуз сынасаңыз болот. Кийин айрым сыноочулар текшерүүлөрдү автоматташтыруу үчүн код жазышат."),
    trial: text("Find a mistake in a booking form", "Катталуу формасынан катаны табыңыз"),
    outcome: text("Try two ages, compare the result with the rule and write a short bug report.", "Эки жашты сынап, жыйынтыкты эреже менен салыштырып, кыска ката отчётун жазыңыз."),
    next: text("Pick a familiar app and write one clear rule for a feature. Try one input that should work and one that should not. Keep a short note of the steps and results.", "Тааныш колдонмодон бир функцияны тандап, ага так эреже жазыңыз. Иштеши керек болгон бир маалыматты жана иштебеши керек болгон бирин сынаңыз. Кадамдар менен жыйынтыктарды кыскача жазыңыз."),
    ai: text("AI can suggest extra things to test. Run those checks yourself: a suggested bug is only useful when you can show it happening.", "AI дагы эмнени сынаса болорун сунуштай алат. Ал текшерүүлөрдү өзүңүз аткарыңыз: сунушталган катаны көрсөтө алсаңыз гана ал пайдалуу."),
    resource: { label: "ISTQB · Testing foundations (PDF)", url: "https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf" },
  },
];

export interface ActivityDraft {
  included?: number[]; coffee?: string; tea?: string; code?: string;
  age?: string; runs?: number[]; expected?: string; actual?: string;
}
export interface CareerTrial { note: string; decision: NextDecision; saved: boolean; completed: boolean; draft: ActivityDraft }
export interface CareerProgress { version: 2; view: RouteView; selected: GuideId | null; trials: Partial<Record<GuideId, CareerTrial>> }
export const careerStorageKey = "skillscope-career-route";
export const guideIds = careerGuides.map((guide) => guide.id);

export function readCareerProgress(raw: string | null): CareerProgress {
  const empty: CareerProgress = { version: 2, view: "fields", selected: null, trials: {} };
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return empty;
    const trials: CareerProgress["trials"] = {};
    for (const id of guideIds) {
      const trial = value.trials?.[id];
      if (!trial || typeof trial !== "object") continue;
      const draft: ActivityDraft = {};
      for (const field of ["coffee", "tea", "code", "age", "expected", "actual"] as const) {
        if (typeof trial.draft?.[field] === "string") draft[field] = trial.draft[field].slice(0, field === "code" ? 3000 : 400);
      }
      if (Array.isArray(trial.draft?.included)) draft.included = [...new Set<number>(trial.draft.included.filter((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < 6))];
      if (Array.isArray(trial.draft?.runs)) draft.runs = [...new Set<number>(trial.draft.runs.filter((n: unknown) => n === 15 || n === 16))];
      const decision = ["continue", "compare", "repeat"].includes(trial.decision) ? trial.decision as NextDecision : "";
      trials[id] = { note: typeof trial.note === "string" ? trial.note.slice(0, 400) : "", decision, saved: trial.saved === true && decision !== "", completed: value.version === 2 && trial.completed === true, draft };
    }
    const selected = guideIds.includes(value.selected) ? value.selected as GuideId : null;
    // Preserve earlier reflections, but introduce the new guide before resuming an old task.
    let view: RouteView = selected ? value.version === 2 && ["learn", "practice", "next"].includes(value.view) ? value.view as RouteView : "learn" : "fields";
    if (view === "next" && selected && !trials[selected]?.completed) view = "learn";
    return { version: 2, view, selected, trials };
  } catch { return empty; }
}
