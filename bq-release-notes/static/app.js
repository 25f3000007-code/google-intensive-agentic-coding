document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotesData = null;
    let currentFilterType = 'all';
    let currentSearchQuery = '';
    let currentFilteredEntries = [];

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-btn');
    const retryBtn = document.getElementById('retry-btn');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterTags = document.querySelectorAll('.filter-tag');
    const notesFeed = document.getElementById('notes-feed');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    const lastUpdatedText = document.getElementById('last-updated-text');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
    const postTweetBtn = document.getElementById('post-tweet-btn');

    // Initialize application
    fetchReleaseNotes();

    // Event Listeners
    refreshBtn.addEventListener('click', fetchReleaseNotes);
    exportBtn.addEventListener('click', exportToCSV);
    retryBtn.addEventListener('click', fetchReleaseNotes);
    clearFiltersBtn.addEventListener('click', resetFilters);

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = currentSearchQuery.length > 0 ? 'block' : 'none';
        applyFilters();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
    });

    // Filter tags
    filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilterType = tag.getAttribute('data-type');
            applyFilters();
        });
    });

    // Modal Close
    closeModalBtn.addEventListener('click', closeTweetModal);
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    
    // Close modal if clicking outside of the card
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Character counter for Twitter
    tweetTextarea.addEventListener('input', updateCharCount);

    // Post tweet
    postTweetBtn.addEventListener('click', () => {
        const tweetText = tweetTextarea.value;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        closeTweetModal();
    });

    // Fetch release notes from Flask API
    async function fetchReleaseNotes() {
        showState('loading');
        refreshBtn.classList.add('loading');
        
        try {
            const response = await fetch('/api/release-notes');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
            }
            
            releaseNotesData = await response.json();
            
            // Update last updated timestamp
            const now = new Date();
            lastUpdatedText.textContent = `Last updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            applyFilters();
        } catch (error) {
            console.error('Error fetching release notes:', error);
            errorMessage.textContent = error.message || 'Could not connect to the server.';
            showState('error');
        } finally {
            refreshBtn.classList.remove('loading');
        }
    }

    // Reset filters helper
    function resetFilters() {
        searchInput.value = '';
        currentSearchQuery = '';
        clearSearchBtn.style.display = 'none';
        
        filterTags.forEach(t => t.classList.remove('active'));
        document.querySelector('.filter-tag[data-type="all"]').classList.add('active');
        currentFilterType = 'all';
        
        applyFilters();
    }

    // Filter and search logic
    function applyFilters() {
        if (!releaseNotesData || !releaseNotesData.entries) return;

        const filteredEntries = [];

        releaseNotesData.entries.forEach(entry => {
            const matchedItems = entry.items.filter(item => {
                // 1. Type matching
                const typeMatches = currentFilterType === 'all' || item.type.toLowerCase() === currentFilterType.toLowerCase();
                
                // 2. Text search matching
                const cleanBodyText = stripHtml(item.body).toLowerCase();
                const searchMatches = currentSearchQuery === '' || 
                    cleanBodyText.includes(currentSearchQuery) || 
                    item.type.toLowerCase().includes(currentSearchQuery) ||
                    entry.date.toLowerCase().includes(currentSearchQuery);
                
                return typeMatches && searchMatches;
            });

            if (matchedItems.length > 0) {
                filteredEntries.push({
                    ...entry,
                    items: matchedItems
                });
            }
        });

        currentFilteredEntries = filteredEntries;
        renderFeed(filteredEntries);
    }

    // Render feed items
    function renderFeed(entries) {
        if (entries.length === 0) {
            showState('empty');
            return;
        }

        notesFeed.innerHTML = '';
        
        entries.forEach(entry => {
            const dateSection = document.createElement('section');
            dateSection.className = 'date-section';

            // Create Date Header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            
            const dateTitle = document.createElement('h2');
            dateTitle.className = 'date-title';
            dateTitle.textContent = entry.date;
            
            const dateLine = document.createElement('div');
            dateLine.className = 'date-line';
            
            const dateLink = document.createElement('a');
            dateLink.className = 'date-link';
            dateLink.href = entry.link;
            dateLink.target = '_blank';
            dateLink.rel = 'noopener noreferrer';
            dateLink.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> Docs';

            dateHeader.appendChild(dateTitle);
            dateHeader.appendChild(dateLine);
            dateHeader.appendChild(dateLink);
            dateSection.appendChild(dateHeader);

            // Create individual updates under this date
            entry.items.forEach(item => {
                const updateItem = document.createElement('div');
                updateItem.className = 'update-item';
                
                // Set custom color property based on update type
                const accentColor = getTypeColor(item.type);
                updateItem.style.setProperty('--tag-color', accentColor);

                // Update Header (Badge)
                const updateHeader = document.createElement('div');
                updateHeader.className = 'update-header';
                
                const typeBadge = document.createElement('div');
                typeBadge.className = 'type-badge';
                typeBadge.innerHTML = `<span class="badge-dot"></span>${item.type}`;
                
                updateHeader.appendChild(typeBadge);
                updateItem.appendChild(updateHeader);

                // Update Body (HTML content)
                const updateBody = document.createElement('div');
                updateBody.className = 'update-body';
                updateBody.innerHTML = item.body;
                updateItem.appendChild(updateBody);

                // Action Bar (Tweet & Copy Buttons)
                const updateActions = document.createElement('div');
                updateActions.className = 'update-actions';
                
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                copyBtn.addEventListener('click', () => copyToClipboard(entry, item, copyBtn));

                const tweetBtn = document.createElement('button');
                tweetBtn.className = 'tweet-btn';
                tweetBtn.innerHTML = '<i class="fa-brands fa-x-twitter"></i> Tweet';
                tweetBtn.addEventListener('click', () => openTweetModal(entry, item));

                updateActions.appendChild(copyBtn);
                updateActions.appendChild(tweetBtn);
                updateItem.appendChild(updateActions);

                dateSection.appendChild(updateItem);
            });

            notesFeed.appendChild(dateSection);
        });

        showState('content');
    }

    // Helper to get color values for types
    function getTypeColor(type) {
        const colors = {
            'feature': 'var(--color-feature)',
            'announcement': 'var(--color-announcement)',
            'breaking': 'var(--color-breaking)',
            'issue': 'var(--color-issue)',
            'change': 'var(--color-change)',
            'general': 'var(--color-general)'
        };
        return colors[type.toLowerCase()] || 'var(--color-general)';
    }

    // Helper to strip HTML tags
    function stripHtml(html) {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    // UI state switcher
    function showState(state) {
        loadingState.style.display = state === 'loading' ? 'flex' : 'none';
        errorState.style.display = state === 'error' ? 'flex' : 'none';
        emptyState.style.display = state === 'empty' ? 'flex' : 'none';
        notesFeed.style.display = state === 'content' ? 'flex' : 'none';
    }

    // Modal Operations
    function openTweetModal(entry, item) {
        const defaultTweet = generateTweetContent(entry, item);
        tweetTextarea.value = defaultTweet;
        updateCharCount();
        
        tweetModal.classList.add('open');
        tweetModal.style.display = 'flex';
        tweetTextarea.focus();
    }

    function closeTweetModal() {
        tweetModal.classList.remove('open');
        setTimeout(() => {
            tweetModal.style.display = 'none';
        }, 300);
    }

    function generateTweetContent(entry, item) {
        const date = entry.date;
        const type = item.type;
        const url = entry.link || 'https://cloud.google.com/bigquery/docs/release-notes';
        
        let bodyText = stripHtml(item.body)
            .replace(/\s+/g, ' ')
            .trim();
        
        const prefix = `Google Cloud #BigQuery ${type} Update (${date}):\n\n`;
        const suffix = `\n\nRead more: ${url}`;
        
        // Twitter limits length to 280 chars
        const availableSpace = 280 - prefix.length - suffix.length;
        if (bodyText.length > availableSpace) {
            bodyText = bodyText.substring(0, availableSpace - 3) + '...';
        }
        
        return `${prefix}${bodyText}${suffix}`;
    }

    function updateCharCount() {
        const remaining = 280 - tweetTextarea.value.length;
        charCounter.textContent = remaining;
        
        if (remaining < 0) {
            charCounter.parentElement.classList.add('warning');
            postTweetBtn.disabled = true;
            postTweetBtn.style.opacity = '0.5';
            postTweetBtn.style.cursor = 'not-allowed';
        } else {
            charCounter.parentElement.classList.remove('warning');
            postTweetBtn.disabled = false;
            postTweetBtn.style.opacity = '1';
            postTweetBtn.style.cursor = 'pointer';
        }
    }

    // Utility: Copy to Clipboard
    async function copyToClipboard(entry, item, button) {
        const date = entry.date;
        const type = item.type;
        const url = entry.link || 'https://cloud.google.com/bigquery/docs/release-notes';
        const cleanBody = stripHtml(item.body).replace(/\s+/g, ' ').trim();
        
        const textToCopy = `Google Cloud BigQuery Release Update (${date})\nType: ${type}\n\n${cleanBody}\n\nRead more: ${url}`;
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // Visual feedback
            button.classList.add('copied');
            button.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            button.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error';
            setTimeout(() => {
                button.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            }, 2000);
        }
    }

    // Utility: Export to CSV
    function exportToCSV() {
        if (!currentFilteredEntries || currentFilteredEntries.length === 0) {
            alert('No data to export.');
            return;
        }

        const rows = [["Date", "Type", "Link", "Content"]];
        
        currentFilteredEntries.forEach(entry => {
            entry.items.forEach(item => {
                const cleanBodyText = stripHtml(item.body).replace(/\s+/g, ' ').trim();
                rows.push([
                    entry.date,
                    item.type,
                    entry.link || 'https://cloud.google.com/bigquery/docs/release-notes',
                    cleanBodyText
                ]);
            });
        });

        const csvContent = rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);
    }
});
