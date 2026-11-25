import {
  currentAdjustedSteps,
  groupIngredients,
  leftOutIngredients,
  type Recipe,
} from '@app/shared';
import { cn } from 'cn';
import { CircleMinus, CirclePlus, Clock, LoaderCircle, Users, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface RecipeCardProps {
  recipe: Recipe;
  /** Leaves an ingredient out, or includes it again. Without it the card is read-only. */
  onToggleIngredient?: (index: number) => void;
  /** Rewrites the steps for the left-out ingredients. */
  onAdjustSteps?: () => void;
  adjusting?: boolean;
  /** Why the last adjustment failed, if it did. */
  adjustError?: string | null;
}

/** "cream", "cream and butter", "cream, butter and onion". */
const listOf = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * A recipe laid out for reading: title, servings and times, ingredients, steps, notes. When
 * the card is wide enough (a container query, e.g. the right column of a meal on desktop),
 * the ingredients sit beside the steps and stay in view while the steps scroll.
 *
 * Ingredients the household leaves out are struck through. Once the steps have been
 * adjusted for exactly those, the adjusted steps show, with the originals a click away.
 */
export function RecipeCard({
  recipe,
  onToggleIngredient,
  onAdjustSteps,
  adjusting = false,
  adjustError = null,
}: RecipeCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const facts = [
    recipe.servings ? { icon: Users, label: 'Serves', value: recipe.servings } : null,
    recipe.prepTime ? { icon: Clock, label: 'Prep', value: recipe.prepTime } : null,
    recipe.cookTime ? { icon: Clock, label: 'Cook', value: recipe.cookTime } : null,
  ].filter((fact) => fact !== null);
  const leftOut = leftOutIngredients(recipe);
  const adjusted = currentAdjustedSteps(recipe);
  const steps = adjusted && !showOriginal ? adjusted : recipe.steps;

  return (
    <div className="@container space-y-5">
      {recipe.title || facts.length > 0 ? (
        <div className="space-y-2">
          {recipe.title ? <h3 className="text-xl font-semibold">{recipe.title}</h3> : null}
          {facts.length > 0 ? (
            <dl className="flex flex-wrap gap-2 text-sm">
              {facts.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="bg-secondary flex items-center gap-1.5 rounded-full px-3 py-1"
                >
                  <Icon className="text-muted-foreground size-3.5" aria-hidden />
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 @xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @xl:gap-8">
        {recipe.ingredients.length > 0 ? (
          <section
            aria-labelledby="ingredients-heading"
            className="space-y-2 @xl:sticky @xl:top-6 @xl:self-start"
          >
            <h3 id="ingredients-heading" className="text-sm font-semibold tracking-wide uppercase">
              Ingredients
            </h3>
            {groupIngredients(recipe.ingredients).map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-1">
                {group.section ? (
                  <h4 className="text-muted-foreground pt-1 text-sm font-medium">
                    {group.section}
                  </h4>
                ) : null}
                <ul className="space-y-1">
                  {group.items.map((ingredient) => {
                    const index = recipe.ingredients.indexOf(ingredient);
                    return (
                      <li
                        key={index}
                        className="flex items-center gap-3 border-b border-dashed pb-1 last:border-0"
                      >
                        <span
                          className={cn(
                            'text-muted-foreground w-20 shrink-0 text-right tabular-nums',
                            ingredient.excluded && 'line-through',
                          )}
                        >
                          {ingredient.amount}
                        </span>
                        <span
                          className={cn(
                            'flex-1',
                            ingredient.excluded && 'text-muted-foreground line-through',
                          )}
                        >
                          {ingredient.item}
                          {ingredient.note ? (
                            <span className="text-muted-foreground">, {ingredient.note}</span>
                          ) : null}
                          {ingredient.excluded ? (
                            <span className="sr-only"> (left out)</span>
                          ) : null}
                        </span>
                        {onToggleIngredient ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground size-7 shrink-0"
                            aria-label={`${ingredient.excluded ? 'Include' : 'Leave out'} ${ingredient.item}`}
                            title={ingredient.excluded ? 'Include it again' : 'Leave it out'}
                            onClick={() => onToggleIngredient(index)}
                          >
                            {ingredient.excluded ? <CirclePlus /> : <CircleMinus />}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        {recipe.steps.length > 0 ? (
          <section aria-labelledby="steps-heading" className="space-y-3">
            <h3 id="steps-heading" className="text-sm font-semibold tracking-wide uppercase">
              Steps
            </h3>
            {leftOut.length > 0 ? (
              <div className="bg-secondary/70 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm">
                <p className="text-muted-foreground flex-1">
                  {adjusted
                    ? showOriginal
                      ? 'The original steps.'
                      : `Adjusted to leave out ${listOf(leftOut)}.`
                    : `Leaving out ${listOf(leftOut)}: the steps still mention ${leftOut.length > 1 ? 'them' : 'it'}.`}
                </p>
                {adjusted ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowOriginal(!showOriginal)}>
                    {showOriginal ? 'Show adjusted' : 'Show original'}
                  </Button>
                ) : onAdjustSteps ? (
                  <Button variant="outline" size="sm" disabled={adjusting} onClick={onAdjustSteps}>
                    {adjusting ? (
                      <LoaderCircle className="animate-spin" aria-hidden />
                    ) : (
                      <WandSparkles aria-hidden />
                    )}
                    {adjusting ? 'Adjusting…' : 'Adjust steps'}
                  </Button>
                ) : null}
                {adjustError ? (
                  <p role="alert" className="text-destructive w-full">
                    {adjustError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    aria-hidden
                    className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  >
                    {index + 1}
                  </span>
                  <p className="leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      {recipe.notes ? (
        <section aria-labelledby="recipe-notes-heading" className="space-y-1">
          <h3 id="recipe-notes-heading" className="text-sm font-semibold tracking-wide uppercase">
            Notes
          </h3>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {recipe.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
