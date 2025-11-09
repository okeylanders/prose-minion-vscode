<p align="center">
  <img src="../assets/prose-minion-book.png" alt="Prose Minion" width="120"/>
</p>

<p align="center">
  <strong>Prose Minion Publishing Guide</strong><br/>
  Complete guide for publishing the extension to VS Code Marketplace
</p>

---

# Publishing Guide

## Prerequisites

### 1. Create Publisher Account

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft/GitHub account
3. Create a publisher ID (this will be part of your extension's identifier)

### 2. Generate Personal Access Token (PAT)

1. Go to https://dev.azure.com/
2. Click your profile icon (top right) → **Personal Access Tokens**
3. Click **+ New Token**
4. Configure the token:
   - **Name**: "VS Code Extension Publishing" (or similar)
   - **Organization**: **All accessible organizations**
   - **Expiration**: Choose your preference (90 days, 1 year, custom, etc.)
   - **Scopes**: 
     - Click **Show all scopes** at the bottom
     - Scroll to **Marketplace**
     - Check **Manage** ✅ (this includes publish, unpublish, and all management operations)
5. Click **Create**
6. **COPY THE TOKEN IMMEDIATELY** - you won't see it again!

### 3. Login with vsce

```bash
npx @vscode/vsce login <your-publisher-name>
```

Paste your PAT when prompted. This authenticates you for all publishing operations.

---

## Publishing Workflow

### Pre-Publishing Checklist

- [ ] All features tested in Extension Development Host
- [ ] README.md updated with latest features
- [ ] CHANGELOG.md updated with version notes
- [ ] Version number updated in package.json
- [ ] Screenshots added to README (if applicable)
- [ ] All documentation links working
- [ ] License information correct
- [ ] Repository URL correct in package.json
- [ ] Icon specified in package.json

### Version Management

Follow **semantic versioning**:
- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features (backward compatible)
- **PATCH** (0.0.x): Bug fixes

Update version using npm:

```bash
npm version major  # 1.0.0 → 2.0.0
npm version minor  # 1.0.0 → 1.1.0
npm version patch  # 1.0.0 → 1.0.1
```

This automatically:
- Updates package.json
- Creates a git commit
- Creates a git tag

### Publishing Steps

#### Option 1: Direct Publish

```bash
# Build and publish in one step
npx @vscode/vsce publish
```

This will:
1. Package your extension
2. Validate the package
3. Upload to marketplace
4. Make it immediately available

#### Option 2: Package Then Publish

```bash
# Create .vsix package
npx @vscode/vsce package

# Test the package locally
code --install-extension prose-minion-<version>.vsix

# Publish the package
npx @vscode/vsce publish --packagePath prose-minion-<version>.vsix
```

### Publishing Options

**Patch version publish:**
```bash
npx @vscode/vsce publish patch
```

**Pre-release version:**
```bash
npx @vscode/vsce publish --pre-release
```

**Specific version:**
```bash
npx @vscode/vsce publish 1.2.3
```

---

## Post-Publishing

### Verify Publication

1. Go to https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension-name>
2. Verify:
   - README displays correctly
   - Icon appears
   - Screenshots render
   - Version number is correct
   - Links work

### Common Post-Publishing Issues

**README images not showing:**
- Ensure image paths are relative
- Images must be in the extension package
- Use `assets/` directory for organization

**Extension not appearing:**
- Allow 5-10 minutes for marketplace indexing
- Check publisher dashboard for errors
- Verify extension visibility settings

**Wrong version published:**
- You cannot unpublish individual versions
- Publish a new patch version to fix

---

## Updating an Extension

### Minor Updates

For bug fixes and minor improvements:

```bash
# Update version
npm version patch

# Update CHANGELOG.md with changes

# Publish
npx @vscode/vsce publish
```

### Major Updates

For significant new features:

```bash
# Update version
npm version minor

# Update README.md with new features
# Update CHANGELOG.md with changes
# Add screenshots if needed

# Publish
npx @vscode/vsce publish
```

---

## Unpublishing

⚠️ **Use with caution** - this removes the extension from the marketplace.

### Unpublish Specific Version

```bash
npx @vscode/vsce unpublish <publisher>.<extension-name>@<version>
```

### Unpublish Entire Extension

```bash
npx @vscode/vsce unpublish <publisher>.<extension-name>
```

**Important Notes:**
- Unpublishing is permanent
- Users who installed the extension will keep it
- Extension ID cannot be reused immediately
- Consider deprecation instead of unpublishing

---

## Managing Publisher

### View Publisher Extensions

```bash
npx @vscode/vsce ls <publisher-name>
```

### Update Publisher Info

1. Go to https://marketplace.visualstudio.com/manage/publishers/<publisher-name>
2. Update display name, description, and other details

### Transfer Extension

Contact VS Code Marketplace support if you need to transfer an extension to a different publisher.

---

## Marketplace Statistics

### Viewing Statistics

1. Go to https://marketplace.visualstudio.com/manage
2. Select your extension
3. View:
   - Install count
   - Download trends
   - Rating and reviews
   - Version adoption

### Understanding Metrics

- **Installs**: Number of unique VS Code instances with your extension
- **Downloads**: Total number of times the .vsix was downloaded
- **Rating**: Average user rating (1-5 stars)
- **Acquisition**: How users found your extension

---

## Best Practices

### Before Publishing

1. **Test Thoroughly**: Run through all features in Extension Development Host
2. **Update Documentation**: Ensure README and CHANGELOG are current
3. **Version Appropriately**: Follow semantic versioning strictly
4. **Review Package Contents**: Check what's included in .vsix
5. **Verify Links**: All documentation links should work

###
