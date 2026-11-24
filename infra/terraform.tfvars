# Non-secret settings for this deployment. Secrets are environment variables in CI.
# See infra/README.md.

# Base name for the Vercel, Neon and Sentry projects.
project_name = "meal-planner"

# GitHub user or organization, and this repository's name.
github_owner      = "jrubins"
github_repository = "meal-planner"

# Sentry organization slug.
sentry_organization = "jonbox"

# WorkOS (AuthKit), from the "Meal Planner" workspace: API Keys and the AuthKit domain.
workos_client_id = "client_01M85JYH2S9WYHB9V1GAB1ARQV"
authkit_domain   = "https://tactful-vessel-32.authkit.app"

# Neon organization (Neon requires one for new projects).
neon_org_id = "org-dawn-boat-78015684"

# Vercel gave the API a suffixed address: meal-planner-api.vercel.app was taken.
api_url = "https://meal-planner-api-phi.vercel.app"

# Vercel team "Jon Rubins' projects" (personal), not the work team:
vercel_team_id = "team_VmOKVE4X5FKT5sJdDW2iuEvL"

# Once you've both signed in, add both WorkOS user IDs to lock the app to the two of you:
allowed_user_ids = []
