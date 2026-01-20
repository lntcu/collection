# Collection — Minimalist Bookmark Manager

A beautiful, fast, and keyboard-friendly bookmark manager built with Next.js, React, and Tailwind CSS. Inspired by Apple's design philosophy of simplicity, functionalism, and elegance.

## Features

- **📚 Collections** — Organize bookmarks into separate collections
- **🏷️ Tags** — Add multiple tags to each bookmark for better organization
- **🔍 Search** — Fast full-text search across titles, descriptions, URLs, and tags
- **⚡ Advanced Keyboard Navigation** — Navigate everything with keyboard
- **🎯 Duplicate Detection** — Automatically detects duplicate URLs before adding
- **🌐 Auto-Fetch Metadata** — Automatically fetches title, description, and icon from URLs
- **🎨 Customizable UI** — Three density modes (compact, comfortable, spacious)
- **⚙️ Settings Page** — Customize appearance, sorting, and behavior
- **🖼️ Preview Images** — Optional preview images for bookmarks
- **📊 Smart Sorting** — Sort by newest, oldest, or alphabetically

## Keyboard Shortcuts

### General
- `⌘K` — Add new bookmark
- `/` — Focus search
- `,` — Open settings
- `?` — Show keyboard shortcuts
- `Esc` — Close dialog or clear focus

### Navigation
- `↑` `↓` — Navigate bookmarks
- `1-9` — Switch to collection 1-9
- `Enter` — Open selected bookmark
- `Tab` — Move focus forward
- `Shift+Tab` — Move focus backward

### Actions
- `E` — Edit tags of selected bookmark
- `Delete` or `Backspace` — Delete selected bookmark

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Adding Bookmarks

1. Press `⌘K` or click the input at the top
2. Paste or type a URL
3. Press `Enter`
4. The app will automatically fetch the title, description, and icon

### Creating Collections

1. Click "New Collection" in the sidebar
2. Enter a name and press `Enter`
3. Switch between collections by clicking on them

### Adding Tags

1. Hover over a bookmark card
2. Click "Add tags" or "Edit tags"
3. Enter tags separated by commas (e.g., `design, inspiration, tutorial`)
4. Press `Enter` to save

### Searching

1. Press `/` to focus the search bar
2. Type your query to search across all bookmark fields
3. Click tags to filter by specific tags
4. Use arrow keys to navigate results

### Settings

1. Press `,` or click the settings icon
2. Customize:
   - **UI Density** — Choose compact, comfortable, or spacious
   - **Sort Order** — Newest, oldest, or alphabetical
   - **Display Options** — Show/hide descriptions and images
   - **Behavior** — Open in new tab, confirm deletes
3. Changes save automatically

## Tech Stack

- **Next.js 16** — React framework with App Router
- **React 19** — UI library
- **Tailwind CSS 4** — Utility-first CSS
- **TypeScript** — Type safety
- **LocalStorage** — Client-side data persistence

## Design Philosophy

This project follows Dieter Rams' ten principles of good design:

1. **Good design is innovative** — Modern web technologies and UX patterns
2. **Good design makes a product useful** — Fast, keyboard-friendly, and efficient
3. **Good design is aesthetic** — Clean, minimal interface with attention to detail
4. **Good design makes a product understandable** — Intuitive navigation and actions
5. **Good design is unobtrusive** — Stays out of your way
6. **Good design is honest** — Clear and transparent functionality
7. **Good design is long-lasting** — Timeless design that won't feel dated
8. **Good design is thorough** — Attention to every detail
9. **Good design is environmentally friendly** — Efficient, no unnecessary features
10. **Good design is as little design as possible** — Less, but better

## Future Enhancements

- [ ] Export/import bookmarks
- [ ] Dark mode support
- [ ] Nested collections / folder hierarchies
- [ ] Browser extension
- [ ] Sync across devices
- [ ] Archive functionality
- [ ] Bulk operations
- [ ] Custom themes

## License

MIT
