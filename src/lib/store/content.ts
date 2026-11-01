// Loads the content JSON once. Tests swap it with setContent().
import exercisesRaw from "@/content/exercises.json";
import recipesRaw from "@/content/recipes.json";
import boughtRaw from "@/content/bought.json";
import saucesRaw from "@/content/sauces.json";
import { parseBought, parseExercises, parseRecipes, parseSauces } from "../engine/content";
import type { Content } from "../types";

let content: Content | null = null;

export function getContent(): Content {
  if (!content) {
    content = {
      exercises: parseExercises(exercisesRaw),
      recipes: parseRecipes(recipesRaw),
      bought: parseBought(boughtRaw),
      sauces: parseSauces(saucesRaw),
    };
  }
  return content;
}

export function setContent(c: Content | null): void {
  content = c;
}
