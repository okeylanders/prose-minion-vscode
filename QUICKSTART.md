# Quick Start Guide

## Running the Extension

### Step 1: Build
```bash
npm install  # If you haven't already
npm run watch
```

### Step 2: Launch Extension Development Host
1. Press **F5** in VS Code
2. A new VS Code window will open with `[Extension Development Host]` in the title
3. You should see a notification: "Prose Minion extension activated!"

### Step 3: Find the Extension

#### Option A: Activity Bar Icon
- Look for the hexagon icon in the left sidebar
- Click it to open the Prose Minion panel

#### Option B: Command Palette
- Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux)
- Type: `Views: Show Prose Minion`
- Press Enter

#### Option C: Right-click Menu
1. Open any text file
2. Select some text
3. Right-click
4. Choose "Analyze with Prose Minion"

## Debugging

### View Console Logs
1. In the Extension Development Host window
2. **Help** → **Toggle Developer Tools**
3. Go to **Console** tab
4. Look for "Prose Minion" messages

### View Extension Host Logs
1. **View** → **Output** (or Cmd+Shift+U)
2. Select **"Extension Host"** from dropdown
3. Look for activation messages

## Testing the Extension

### Test Analysis Tab
1. Open the Prose Minion panel
2. Type or paste some text
3. Click "Analyze Dialogue" or "Analyze Prose"
4. You should see placeholder results

### Test Metrics Tab
1. Click the "Metrics" tab
2. Type or paste some text
3. Click "Prose Statistics"
4. You should see word count, sentence count, etc.

### Test Selection Integration
1. Open any text file
2. Select text with your cursor
3. The selected text should automatically appear in the Prose Minion panel

## Common Issues

### Extension doesn't activate
- Check Output → Extension Host for errors
- Make sure `dist/extension.js` exists
- Try running `npm run build` first

### Icon doesn't appear
- The extension is registered as a view container
- Try opening via Command Palette: `Views: Show Prose Minion`
- Check package.json contributes section

### Webview is blank
- Check browser console (Help → Toggle Developer Tools)
- Make sure `dist/webview.js` exists
- Look for JavaScript errors

### Changes not reflected
- Make sure `npm run watch` is running
- Reload the Extension Development Host: Cmd+R (Mac) or Ctrl+R (Windows)

## Next Steps

Once you verify the extension works:
1. Test all three tabs
2. Try the right-click context menu
3. Test with different text selections
4. Check that the UI matches VS Code theme
5. Start integrating real prose-minion tools
