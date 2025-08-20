# GitHub Push Instructions

## Step 1: Create GitHub Repository

1. Go to https://github.com
2. Sign in to your account (or create one if needed)
3. Click the **"+"** button in top right → **"New repository"**
4. Configure repository:
   - **Repository name**: `locavia-sync-service`
   - **Description**: "Data synchronization service between Locavia API and MySQL for Power BI analytics"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have them)
5. Click **"Create repository"**

## Step 2: Add Remote Origin and Push

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
# Add remote origin (replace 'yourusername' with your GitHub username)
git remote add origin https://github.com/yourusername/locavia-sync-service.git

# Verify remote was added
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

If you're using SSH instead of HTTPS:
```bash
git remote add origin git@github.com:yourusername/locavia-sync-service.git
git branch -M main
git push -u origin main
```

## Step 3: Verify on GitHub

1. Refresh your GitHub repository page
2. You should see all files uploaded
3. Check that README.md is displayed on the main page

## Step 4: Update Claude Prompt

Once pushed, update the `CLAUDE_PROMPT.md` file with your actual repository URL:

1. Edit line in CLAUDE_PROMPT.md:
   ```
   **GitHub Repository**: https://github.com/yourusername/locavia-sync-service
   ```

2. Commit and push the update:
   ```bash
   git add CLAUDE_PROMPT.md
   git commit -m "docs: update GitHub repository URL"
   git push
   ```

## Step 5: Clone on Windows Machine

On your Windows machine:

```powershell
# Open PowerShell or Git Bash
cd C:\Projects

# Clone your repository
git clone https://github.com/yourusername/locavia-sync-service.git

# Enter directory
cd locavia-sync-service

# Install dependencies
npm install

# Copy .env.example to .env and configure
copy .env.example .env
notepad .env
```

## Troubleshooting

### Authentication Issues

If prompted for authentication:

**For HTTPS:**
- Username: Your GitHub username
- Password: Your GitHub Personal Access Token (not your password!)
  - Create token at: https://github.com/settings/tokens
  - Select scopes: `repo` (full control)

**For SSH:**
- Set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### Push Rejected

If push is rejected:
```bash
# Force push (use carefully!)
git push -u origin main --force

# Or pull first then push
git pull origin main --allow-unrelated-histories
git push origin main
```

## Repository Settings (Optional)

After pushing, configure repository settings on GitHub:

1. Go to **Settings** tab
2. Add **Topics**: `nodejs`, `mysql`, `powerbi`, `typescript`, `api`, `sync`
3. Set up **GitHub Pages** if you want documentation site
4. Configure **Branch protection** for main branch
5. Add **Collaborators** if working with team

## Using the Claude Prompt

When starting work on Windows:

1. Open the `CLAUDE_PROMPT.md` file
2. Copy entire contents
3. Paste as first message to Claude
4. Claude will have full context of your project

## Next Steps

1. Set up GitHub Actions for CI/CD (optional)
2. Create development branch for new features
3. Use Pull Requests for code review
4. Set up Issues for bug tracking
5. Create Wiki for additional documentation

---

**Remember to update this file with your actual GitHub username after creating the repository!**