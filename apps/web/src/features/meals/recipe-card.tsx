import { groupIngredients, type Recipe } from '@app/shared';
import { Clock, Users } from 'lucide-react';

/** A recipe laid out for reading: title, servings and times, ingredients, steps, notes. */
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const facts = [
    recipe.servings ? { icon: Users, label: 'Serves', value: recipe.servings } : null,
    recipe.prepTime ? { icon: Clock, label: 'Prep', value: recipe.prepTime } : null,
    recipe.cookTime ? { icon: Clock, label: 'Cook', value: recipe.cookTime } : null,
  ].filter((fact) => fact !== null);

  return (
    <div className="space-y-5">
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

      {recipe.ingredients.length > 0 ? (
        <section aria-labelledby="ingredients-heading" className="space-y-2">
          <h3 id="ingredients-heading" className="text-sm font-semibold tracking-wide uppercase">
            Ingredients
          </h3>
          {groupIngredients(recipe.ingredients).map((group, index) => (
            <div key={index} className="space-y-1">
              {group.section ? (
                <h4 className="text-muted-foreground pt-1 text-sm font-medium">{group.section}</h4>
              ) : null}
              <ul className="space-y-1">
                {group.items.map((ingredient, i) => (
                  <li key={i} className="flex gap-3 border-b border-dashed pb-1 last:border-0">
                    <span className="text-muted-foreground w-20 shrink-0 text-right tabular-nums">
                      {ingredient.amount}
                    </span>
                    <span>
                      {ingredient.item}
                      {ingredient.note ? (
                        <span className="text-muted-foreground">, {ingredient.note}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {recipe.steps.length > 0 ? (
        <section aria-labelledby="steps-heading" className="space-y-2">
          <h3 id="steps-heading" className="text-sm font-semibold tracking-wide uppercase">
            Steps
          </h3>
          <ol className="space-y-3">
            {recipe.steps.map((step, index) => (
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
