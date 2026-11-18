import { FOODS_AR } from "@/lib/food/foods-ar-data";
import { normalize } from "@/lib/text";

export interface MealIdea {
  nombre: string;
  receta: string;
  tiempo_min: number;
  ingredientes: { nombre: string; gramos: number; kcal: number; proteina: number; carbos: number; grasa: number }[];
  kcal: number;
  proteina: number;
  carbos: number;
  grasa: number;
}

type Diet = "omnivore" | "vegetarian" | "vegan" | "other";
interface Template {
  nombre: string;
  receta: string;
  tiempo: number;
  momentos: string[];
  dieta: Diet[];
  items: [string, number][]; // [nombre en FOODS_AR, gramos]
}

const ALL: Diet[] = ["omnivore", "vegetarian", "vegan", "other"];
const VEG: Diet[] = ["omnivore", "vegetarian", "other"];
const OMNI: Diet[] = ["omnivore", "other"];

const TEMPLATES: Template[] = [
  { nombre: "Tostadas con revuelto y queso", receta: "Revolvé 2 huevos en sartén, tostá el pan y sumale una feta de queso.", tiempo: 10, momentos: ["breakfast", "snack"], dieta: VEG, items: [["Pan lactal integral", 50], ["Revuelto de huevo", 120], ["Queso de máquina (Tybo)", 20]] },
  { nombre: "Yogur proteico con avena y banana", receta: "Mezclá el yogur con la avena y la banana en rodajas. Listo en 2 minutos.", tiempo: 3, momentos: ["breakfast", "snack", "extra"], dieta: VEG, items: [["Yogur alto en proteína", 160], ["Avena", 30], ["Banana", 120]] },
  { nombre: "Licuado de banana con whey", receta: "Licuá leche, banana y un scoop de proteína. Ideal post entreno.", tiempo: 3, momentos: ["breakfast", "snack", "extra"], dieta: VEG, items: [["Leche descremada", 300], ["Banana", 120], ["Proteína whey (polvo)", 30]] },
  { nombre: "Mate cocido con tostado de jamón y queso", receta: "Clásico de merienda: un tostado y un mate cocido con leche.", tiempo: 8, momentos: ["breakfast", "snack"], dieta: OMNI, items: [["Tostado de jamón y queso", 150], ["Mate cocido con leche", 250]] },
  { nombre: "Pollo a la plancha con arroz y ensalada", receta: "Pechuga a la plancha con sal y limón, arroz blanco y ensalada mixta con un chorrito de aceite.", tiempo: 25, momentos: ["lunch", "dinner"], dieta: OMNI, items: [["Pechuga de pollo a la plancha", 170], ["Arroz blanco cocido", 200], ["Ensalada mixta con aceite", 200]] },
  { nombre: "Fideos con atún y tomate", receta: "Hervís fideos y los mezclás con una lata de atún, tomate en cubos y un poco de aceite de oliva.", tiempo: 15, momentos: ["lunch", "dinner"], dieta: OMNI, items: [["Fideos cocidos", 250], ["Atún al natural", 120], ["Tomate", 120], ["Aceite de oliva", 10]] },
  { nombre: "Milanesa de carne al horno con puré", receta: "Milanesa al horno (sin fritura) con puré de papas y una ensalada al costado.", tiempo: 30, momentos: ["lunch", "dinner"], dieta: OMNI, items: [["Milanesa de carne al horno", 150], ["Puré de papas", 200], ["Ensalada mixta", 150]] },
  { nombre: "Bife con papas al horno", receta: "Bife de nalga a la plancha con papas al horno y ensalada.", tiempo: 35, momentos: ["lunch", "dinner"], dieta: OMNI, items: [["Nalga", 200], ["Papas al horno", 250], ["Ensalada mixta", 150]] },
  { nombre: "Merluza al horno con calabaza", receta: "Filet de merluza al horno con calabaza asada y un chorrito de aceite.", tiempo: 30, momentos: ["lunch", "dinner"], dieta: OMNI, items: [["Merluza al horno", 200], ["Zapallo / calabaza", 250], ["Aceite de oliva", 10]] },
  { nombre: "Guiso de lentejas", receta: "Lentejas guisadas con verduras: rinde para varios días.", tiempo: 45, momentos: ["lunch", "dinner"], dieta: ALL, items: [["Guiso de lentejas", 400], ["Pan francés", 40]] },
  { nombre: "Tarta de verdura y huevo", receta: "Porción de tarta de verdura con un huevo duro y ensalada.", tiempo: 10, momentos: ["lunch", "dinner"], dieta: VEG, items: [["Tarta de verdura", 180], ["Huevo", 55], ["Ensalada mixta", 150]] },
  { nombre: "Arroz con garbanzos y verduras salteadas", receta: "Salteá verduras y sumá garbanzos cocidos sobre arroz.", tiempo: 20, momentos: ["lunch", "dinner"], dieta: ALL, items: [["Arroz integral cocido", 180], ["Garbanzos cocidos", 160], ["Verduras salteadas", 200]] },
  { nombre: "Tofu salteado con fideos", receta: "Dorá el tofu en cubos y mezclalo con fideos y verduras salteadas.", tiempo: 20, momentos: ["lunch", "dinner"], dieta: ALL, items: [["Tofu", 150], ["Fideos cocidos", 220], ["Verduras salteadas", 150]] },
  { nombre: "Sándwich de pollo", receta: "Pan francés con pechuga a la plancha, tomate y lechuga.", tiempo: 10, momentos: ["lunch", "dinner", "snack"], dieta: OMNI, items: [["Pan francés", 80], ["Pechuga de pollo a la plancha", 120], ["Tomate", 60], ["Lechuga", 20]] },
  { nombre: "Ricota con frutas y miel", receta: "Ricota con frutillas, banana y un hilo de miel.", tiempo: 3, momentos: ["breakfast", "snack", "extra"], dieta: VEG, items: [["Ricota", 120], ["Frutillas", 120], ["Banana", 80], ["Miel", 10]] },
  { nombre: "Fruta y puñado de frutos secos", receta: "Una fruta y un puñado de frutos secos. Snack que no falla.", tiempo: 1, momentos: ["snack", "extra"], dieta: ALL, items: [["Manzana", 180], ["Mix de frutos secos", 30]] },
  { nombre: "Huevos duros con galletas de arroz", receta: "Dos huevos duros con galletas de arroz y un tomate.", tiempo: 12, momentos: ["snack", "extra", "breakfast"], dieta: VEG, items: [["Huevo", 110], ["Galletitas de arroz", 27], ["Tomate", 120]] },
  { nombre: "Pre-partido: pan con dulce y banana", receta: "Carbos fáciles de digerir 2–3 h antes de jugar.", tiempo: 3, momentos: ["breakfast", "snack", "extra"], dieta: ALL, items: [["Pan francés", 80], ["Mermelada", 30], ["Banana", 120]] },
];

const byName = new Map(FOODS_AR.map((f) => [f[0], f]));

export function ideaFromTemplate(t: Template): MealIdea {
  const ingredientes = t.items.map(([name, g]) => {
    const f = byName.get(name);
    if (!f) throw new Error(`Alimento inexistente en plantilla: ${name}`);
    const k = g / 100;
    return { nombre: name, gramos: g, kcal: Math.round(f[2] * k), proteina: Math.round(f[3] * k * 10) / 10, carbos: Math.round(f[4] * k * 10) / 10, grasa: Math.round(f[5] * k * 10) / 10 };
  });
  const sum = (key: "kcal" | "proteina" | "carbos" | "grasa") => Math.round(ingredientes.reduce((s, i) => s + i[key], 0));
  return { nombre: t.nombre, receta: t.receta, tiempo_min: t.tiempo, ingredientes, kcal: sum("kcal"), proteina: sum("proteina"), carbos: sum("carbos"), grasa: sum("grasa") };
}

/** 3 ideas sin IA: filtra por momento, dieta, gustos, tiempo y lo que tenés; ordena por cercanía a lo que te falta. */
export function fallbackIdeas(args: {
  meal: string;
  diet: Diet;
  dislikes: string[];
  allergies: string;
  cookingTime: "low" | "normal" | "high";
  pantry: string;
  remaining: { kcal: number; protein: number };
  mealsLeft: number;
}): MealIdea[] {
  const avoid = [...args.dislikes, ...args.allergies.split(/[,;]/)].map((s) => normalize(s)).filter((s) => s.length > 2);
  const pantry = normalize(args.pantry).split(" ").filter((w) => w.length > 2);
  const maxTime = args.cookingTime === "low" ? 15 : args.cookingTime === "normal" ? 35 : 90;
  const targetKcal = Math.max(250, args.remaining.kcal / Math.max(1, args.mealsLeft));
  const targetProt = Math.max(15, args.remaining.protein / Math.max(1, args.mealsLeft));
  const candidates = TEMPLATES.filter(
    (t) =>
      t.dieta.includes(args.diet) &&
      t.tiempo <= maxTime &&
      !t.items.some(([n]) => avoid.some((a) => normalize(n).includes(a))),
  ).map(ideaFromTemplate);
  const scored = candidates
    .map((i) => {
      const pantryHits = pantry.filter((w) => normalize(i.ingredientes.map((x) => x.nombre).join(" ")).includes(w)).length;
      const momentFit = TEMPLATES.find((t) => t.nombre === i.nombre)!.momentos.includes(args.meal) ? 0 : 2;
      return { i, s: Math.abs(i.kcal - targetKcal) / targetKcal + Math.abs(i.proteina - targetProt) / targetProt + momentFit - pantryHits * 0.6 };
    })
    .sort((a, b) => a.s - b.s);
  return scored.slice(0, 3).map((x) => x.i);
}
