/**
 * NexPhone Studio - Modern ChatGPT-Style RAG Chatbot Controller
 * Manages chat interactions, API calling, markdown rendering, and citations
 */

(function () {
  'use strict';

  class ChatbotController {
    constructor() {
      this.isOpen = false;
      this.isMaximized = false;
      this.isGenerating = false;
      this.history = []; // [{ role: 'user'|'assistant', content: '...' }]

      this.initElements();
      this.attachEventListeners();
    }

    initElements() {
      this.launcherBtn = document.getElementById('chat-launcher-btn');
      this.chatWindow = document.getElementById('chat-widget-window');
      this.closeBtn = document.getElementById('chat-close-btn');
      this.maxBtn = document.getElementById('chat-max-btn');
      this.clearBtn = document.getElementById('chat-clear-btn');
      this.messagesStream = document.getElementById('chat-messages-stream');
      this.welcomeCard = document.getElementById('chat-welcome-card');
      this.chatForm = document.getElementById('chat-input-form');
      this.chatTextarea = document.getElementById('chat-textarea');
      this.sendBtn = document.getElementById('chat-send-btn');
      this.typingIndicator = document.getElementById('typing-indicator-row');

      // AI Nav triggers
      this.navTriggers = document.querySelectorAll('[data-open-chat]');
    }

    attachEventListeners() {
      // Open / Close toggles
      if (this.launcherBtn) {
        this.launcherBtn.addEventListener('click', () => this.toggle());
      }
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.close());
      }

      // Maximize / Minimize
      if (this.maxBtn) {
        this.maxBtn.addEventListener('click', () => this.toggleMaximize());
      }

      // Clear chat
      if (this.clearBtn) {
        this.clearBtn.addEventListener('click', () => this.clearChat());
      }

      // Nav triggers (e.g. from navbar or hero CTA)
      this.navTriggers.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.open();
        });
      });

      // Quick prompt suggestion chips
      document.querySelectorAll('[data-prompt-query]').forEach(chip => {
        chip.addEventListener('click', () => {
          const query = chip.getAttribute('data-prompt-query');
          if (query) {
            this.sendPredefinedMessage(query);
          }
        });
      });

      // Submit message
      if (this.chatForm) {
        this.chatForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSendMessage();
        });
      }

      // Textarea auto-resize and Enter key submission
      if (this.chatTextarea) {
        this.chatTextarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendMessage();
          }
        });

        this.chatTextarea.addEventListener('input', () => {
          this.chatTextarea.style.height = 'auto';
          this.chatTextarea.style.height = Math.min(this.chatTextarea.scrollHeight, 120) + 'px';
        });
      }
    }

    open() {
      if (!this.chatWindow) return;
      this.isOpen = true;
      this.chatWindow.classList.add('open');
      if (this.launcherBtn) {
        this.launcherBtn.style.display = 'none';
      }
      setTimeout(() => {
        if (this.chatTextarea) this.chatTextarea.focus();
      }, 250);
    }

    close() {
      if (!this.chatWindow) return;
      this.isOpen = false;
      this.chatWindow.classList.remove('open');
      if (this.launcherBtn) {
        this.launcherBtn.style.display = 'flex';
      }
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    toggleMaximize() {
      if (!this.chatWindow) return;
      this.isMaximized = !this.isMaximized;
      this.chatWindow.classList.toggle('maximized', this.isMaximized);
      if (this.maxBtn) {
        this.maxBtn.innerHTML = this.isMaximized ? '❐' : '⤢';
        this.maxBtn.title = this.isMaximized ? 'Restore size' : 'Maximize window';
      }
    }

    clearChat() {
      this.history = [];
      const messages = this.messagesStream.querySelectorAll('.message-row');
      messages.forEach(m => m.remove());
      if (this.welcomeCard) {
        this.welcomeCard.style.display = 'block';
      }
    }

    sendPredefinedMessage(text) {
      if (!text || this.isGenerating) return;
      this.open();
      if (this.chatTextarea) {
        this.chatTextarea.value = text;
      }
      this.handleSendMessage();
    }

    async handleSendMessage() {
      const text = (this.chatTextarea?.value || '').trim();
      if (!text || this.isGenerating) return;

      // Clear input
      this.chatTextarea.value = '';
      this.chatTextarea.style.height = 'auto';

      // Hide welcome card once first message is sent
      if (this.welcomeCard) {
        this.welcomeCard.style.display = 'none';
      }

      // Append user bubble
      this.appendMessage('user', text);
      this.history.push({ role: 'user', content: text });

      // Show typing indicator
      this.setGeneratingState(true);
      this.scrollToBottom();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: text,
            history: this.history.slice(-4)
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || `Server returned status ${response.status}`);
        }

        const data = await response.json();
        const answer = data.answer || 'I could not generate an answer right now.';
        const sources = data.sources || [];

        // Append assistant bubble
        this.appendMessage('assistant', answer, sources, data.notice);
        this.history.push({ role: 'assistant', content: answer });

      } catch (err) {
        console.error('Chat error:', err);
        this.appendMessage(
          'assistant',
          `⚠️ **Error communicating with assistant:**\n${err.message || 'Network connection failed. Please verify that the local server or Vercel function is running.'}`
        );
      } finally {
        this.setGeneratingState(false);
        this.scrollToBottom();
      }
    }

    setGeneratingState(isGenerating) {
      this.isGenerating = isGenerating;
      if (this.sendBtn) this.sendBtn.disabled = isGenerating;
      if (this.typingIndicator) {
        this.typingIndicator.style.display = isGenerating ? 'flex' : 'none';
      }
    }

    appendMessage(role, text, sources = [], notice = null) {
      const row = document.createElement('div');
      row.className = `message-row ${role}`;

      if (role === 'user') {
        row.innerHTML = `<div class="msg-bubble">${this.escapeHtml(text)}</div>`;
      } else {
        const formattedHtml = this.parseMarkdown(text);
        
        let sourcesHtml = '';
        if (sources && sources.length > 0) {
          const sourceId = 'src-' + Math.random().toString(36).substring(2, 9);
          sourcesHtml = `
            <div class="msg-sources-container">
              <button class="sources-toggle-btn" onclick="document.getElementById('${sourceId}').classList.toggle('open')">
                <span>📚</span> Grounded Sources (${sources.length}) ▾
              </button>
              <div id="${sourceId}" class="sources-list">
                ${sources.map(s => `
                  <div class="source-item">
                    <span class="source-title">${s.title}</span>
                    <div class="source-meta">
                      ${s.price ? `<span class="source-badge" style="background: rgba(2, 132, 199, 0.12); color: var(--accent);">${s.price}</span>` : ''}
                      <span class="source-badge">Match: ${s.score}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        let noticeHtml = '';
        if (notice) {
          noticeHtml = `
            <div style="font-size: 0.725rem; color: var(--amber); background: rgba(217, 119, 6, 0.1); border: 1px solid rgba(217, 119, 6, 0.25); border-radius: 6px; padding: 0.4rem 0.6rem; margin-top: 0.5rem;">
              💡 <em>${notice}</em>
            </div>
          `;
        }

        row.innerHTML = `
          <div class="bot-msg-avatar">✨</div>
          <div class="msg-content-wrapper">
            <div class="msg-bubble">${formattedHtml}</div>
            ${sourcesHtml}
            ${noticeHtml}
          </div>
        `;
      }

      // Insert before typing indicator
      this.messagesStream.insertBefore(row, this.typingIndicator);
      this.scrollToBottom();
    }

    scrollToBottom() {
      if (this.messagesStream) {
        this.messagesStream.scrollTop = this.messagesStream.scrollHeight;
      }
    }

    escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /**
     * Client-Side Markdown Parser
     * Handles bold, headers, lists, markdown tables, code, blockquotes
     */
    parseMarkdown(text) {
      if (!text) return '';

      let html = text;

      // Escape raw HTML tags (security against XSS)
      html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Blockquotes (> text)
      html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

      // Markdown Tables
      html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
        const lines = match.trim().split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return match;

        let tableHtml = '<table>';
        lines.forEach((line, idx) => {
          if (line.includes('---')) return; // separator row

          const cells = line.split('|').slice(1, -1).map(c => c.trim());
          if (idx === 0) {
            tableHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
          } else {
            tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
          }
        });
        tableHtml += '</tbody></table>';
        return tableHtml;
      });

      // Headers (### Header)
      html = html.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');
      html = html.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');

      // Bold text (**text**)
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Italic (*text*)
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

      // Unordered lists (- item or * item)
      html = html.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

      // Ordered lists (1. item)
      html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

      // Paragraph line breaks
      html = html.replace(/\n\n/g, '<br><br>');

      return html;
    }
  }

  // Initialize and attach to global window
  document.addEventListener('DOMContentLoaded', () => {
    window.NexChat = new ChatbotController();
  });

})();
