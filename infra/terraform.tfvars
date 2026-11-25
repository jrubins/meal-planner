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

# Reading recipe photos (TanStack AI). To switch provider: change ai_provider (and set
# ai_model; required for openai and gemini), put that provider's key in the AI_API_KEY
# Actions secret, and bump ai_api_key_version.
# Claude Haiku 5.5: transcribing a recipe photo needs little reasoning (~0.1¢ a photo).
# Try claude-sonnet-5-5 if handwritten recipes come out poorly.
ai_provider        = "anthropic"
ai_model           = "claude-haiku-5-5"
ai_api_key_version = 2

# Generated meal pictures (TanStack AI). OpenAI's gpt-image-2.5-flare at low quality is about
# 0.6¢ a picture, made only when someone taps "Generate". Use image_quality = "medium" (~1.3¢)
# for more detail. To switch provider: change image_provider (and image_model if needed), put
# that provider's key in the IMAGE_API_KEY Actions secret, and bump image_api_key_version.
image_provider        = "openai"
image_quality         = "low"
image_api_key_version = 1

# Once you've both signed in, add both WorkOS user IDs to lock the app to the two of you:
allowed_user_ids = []
