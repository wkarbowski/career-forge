#!/usr/bin/env python3
"""Write the new DocumentDashboard.css file."""
import os

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    '..', 'client', 'src', 'components', 'DocumentDashboard.css')

CONTENT = r'''.cv-dashboard {
  min-height: calc(100vh - 60px);
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 32px 40px;
}

/* ===== Header ===== */
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  font-family: 'Rubik', sans-serif;
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.new-doc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.new-doc-btn.resume {
  background: var(--accent-color);
  color: #fff;
}

.new-doc-btn.resume:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(var(--accent-rgb, 59,130,246), 0.25);
}

.new-doc-btn.cover-letter {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.new-doc-btn.cover-letter:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

/* ===== Toolbar ===== */
.dashboard-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-box > i.fa-search {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 14px;
  pointer-events: none;
}

.search-box input {
  width: 100%;
  padding: 10px 36px 10px 40px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.search-box input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.clear-search {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ===== Filter Dropdown Pill ===== */
.filter-dropdown {
  position: relative;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-pill:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.filter-chevron {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.filter-chevron.open {
  transform: rotate(180deg);
}

.filter-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 180px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  z-index: 100;
  overflow: hidden;
  animation: filterMenuIn 0.12s ease;
}

@keyframes filterMenuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.filter-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
}

.filter-menu-item:hover {
  background: var(--bg-hover);
}

.filter-menu-item.active {
  color: var(--accent-color);
  font-weight: 600;
  background: var(--accent-muted);
}

.filter-menu-item i {
  width: 16px;
  text-align: center;
  font-size: 13px;
}

/* ===== Count & View Toggle ===== */
.cv-count {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 2px;
}

.view-toggle-btn {
  padding: 7px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s ease;
  font-size: 13px;
}

.view-toggle-btn:hover {
  color: var(--text-primary);
}

.view-toggle-btn.active {
  background: var(--accent-color);
  color: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.delete-selected-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--error-bg, #ffeef0);
  color: var(--error-color, #dc3545);
  border: 1px solid var(--error-border, #f5c2c7);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.delete-selected-btn:hover:not(:disabled) {
  background: var(--error-color, #dc3545);
  color: #fff;
}

/* ===== Section Headings ===== */
.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 24px 0 14px;
  font-family: 'Rubik', sans-serif;
}

.section-heading > i {
  color: var(--text-muted);
  font-size: 14px;
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  background: var(--accent-muted);
  color: var(--accent-color);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.documents-heading {
  margin-top: 28px;
}

/* ===== Application Packages ===== */
.packages-section {
  margin-bottom: 8px;
}

.packages-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.package-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.package-row:hover {
  border-color: var(--border-hover);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.package-docs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.package-doc {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-primary);
  transition: background 0.12s ease;
  max-width: 250px;
  overflow: hidden;
}

.package-doc:hover {
  background: var(--bg-hover);
}

.package-doc i {
  flex-shrink: 0;
  font-size: 12px;
}

.package-doc.resume i {
  color: var(--accent-color);
}

.package-doc.cover-letter i {
  color: var(--warning-color, #e67e22);
}

.package-doc-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.package-link-icon {
  color: var(--text-muted);
  font-size: 11px;
  flex-shrink: 0;
}

.package-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.package-date {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.package-date i {
  font-size: 11px;
}

.package-actions {
  display: flex;
  gap: 4px;
}

.pkg-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.12s ease;
}

.pkg-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.pkg-action-btn.unlink:hover {
  background: var(--error-bg, #ffeef0);
  color: var(--error-color, #dc3545);
}

/* ===== Grid View ===== */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.dashboard-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 0;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.dashboard-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}

.dashboard-card.selected {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-muted);
}

.dashboard-card:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.dashboard-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px 0;
}

.card-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.card-type-badge.resume {
  background: var(--accent-muted);
  color: var(--accent-color);
}

.card-type-badge.cover-letter {
  background: rgba(230, 126, 34, 0.1);
  color: var(--warning-color, #e67e22);
}

.card-type-badge i {
  font-size: 10px;
}

.card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.dashboard-card:hover .card-actions {
  opacity: 1;
}

.card-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.12s ease;
}

.card-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.card-action-btn.danger:hover {
  background: var(--error-bg, #ffeef0);
  color: var(--error-color, #dc3545);
}

.card-action-btn.shared {
  color: var(--accent-color);
}

.dashboard-card-body {
  padding: 14px 16px 8px;
  flex: 1;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.inline-edit-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-muted);
  box-sizing: border-box;
}

/* Link chip on card */
.card-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  margin: 0;
}

.card-link-chip.linked {
  background: var(--accent-muted);
  color: var(--accent-color);
}

.card-link-chip.linked i {
  font-size: 10px;
}

/* Link prompt on unlinked cover letters */
.card-link-prompt {
  margin-top: 6px;
}

.link-prompt-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px dashed var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.link-prompt-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--accent-muted);
}

.link-prompt-btn.small {
  padding: 3px 8px;
  font-size: 11px;
}

.inline-link-picker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.link-picker-select {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.link-picker-select:focus {
  border-color: var(--accent-color);
}

.link-picker-confirm,
.link-picker-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.12s ease;
}

.link-picker-confirm {
  background: var(--accent-color);
  color: #fff;
}

.link-picker-confirm:disabled {
  opacity: 0.4;
  cursor: default;
}

.link-picker-cancel {
  background: var(--bg-hover);
  color: var(--text-muted);
}

/* ===== Ghost Card ===== */
.ghost-card {
  border: 2px dashed var(--border-color) !important;
  background: transparent !important;
  box-shadow: none !important;
  min-height: 160px;
}

.ghost-card:hover {
  border-color: var(--accent-color) !important;
  background: var(--accent-muted) !important;
  transform: none !important;
}

.ghost-card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 140px;
  gap: 10px;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
}

.ghost-card:hover .ghost-card-inner {
  color: var(--accent-color);
}

.ghost-card-inner i {
  font-size: 28px;
}

/* ===== Card Footer ===== */
.dashboard-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid var(--border-color);
  margin-top: auto;
}

.card-date {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-date i {
  font-size: 11px;
}

.card-quick-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.dashboard-card:hover .card-quick-actions {
  opacity: 1;
}

/* ===== Table View ===== */
.table-container {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.cv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.cv-table thead {
  background: var(--bg-secondary);
}

.cv-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.cv-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.cv-table tbody tr {
  transition: background 0.1s ease;
}

.cv-table tbody tr:hover {
  background: var(--bg-hover);
}

.cv-table tbody tr.selected {
  background: var(--accent-muted);
}

.cv-table tbody tr:last-child td {
  border-bottom: none;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.sort-icon {
  margin-left: 6px;
  font-size: 11px;
}

.sort-icon.inactive {
  opacity: 0.3;
}

.col-checkbox {
  width: 40px;
  text-align: center;
}

.col-title {
  min-width: 200px;
}

.col-type {
  width: 140px;
}

.col-link {
  width: 200px;
}

.col-updated {
  width: 160px;
  color: var(--text-muted);
  font-size: 13px;
}

.col-actions {
  width: 200px;
}

.cv-title-text {
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
}

.cv-title-text:hover {
  color: var(--accent-color);
}

.table-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.table-type-badge.resume {
  background: var(--accent-muted);
  color: var(--accent-color);
}

.table-type-badge.cover-letter {
  background: rgba(230, 126, 34, 0.1);
  color: var(--warning-color, #e67e22);
}

/* Link pill in table */
.link-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-pill.linked {
  background: var(--accent-muted);
  color: var(--accent-color);
}

.link-pill.linked i {
  font-size: 10px;
  flex-shrink: 0;
}

/* ===== Table Action Buttons ===== */
.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.12s ease;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn.edit:hover {
  color: var(--accent-color);
}

.action-btn.delete:hover {
  background: var(--error-bg, #ffeef0);
  color: var(--error-color, #dc3545);
}

.action-btn.share.shared {
  color: var(--accent-color);
}

/* ===== Table Footer ===== */
.table-footer {
  padding: 14px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

/* ===== Empty State ===== */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-muted);
}

.empty-state > i {
  font-size: 40px;
  margin-bottom: 14px;
  opacity: 0.3;
  display: block;
}

.empty-state p {
  font-size: 14px;
  margin: 0 0 16px;
}

.grid-empty {
  grid-column: 1 / -1;
}

.empty-state-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.empty-state-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.empty-state-btn:hover {
  background: var(--accent-hover);
}

/* ===== Share Modal ===== */
.share-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.share-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.share-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color);
}

.share-modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.share-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.12s ease;
}

.share-modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.share-modal-body {
  padding: 20px;
}

.share-modal-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  margin: 0 0 10px;
}

.share-link-row {
  display: flex;
  gap: 8px;
}

.share-link-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.share-copy-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.share-copy-btn:hover {
  background: var(--accent-hover);
}

.share-copy-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.share-modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.share-revoke-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--error-border, #f5c2c7);
  border-radius: 8px;
  color: var(--error-color, #dc3545);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.share-revoke-btn:hover {
  background: var(--error-bg, #ffeef0);
}

/* Link Modal */
.link-modal .share-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-modal-select {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.link-modal-select:focus {
  border-color: var(--accent-color);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .cv-dashboard {
    padding: 20px 16px;
  }

  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .header-actions {
    width: 100%;
  }

  .new-doc-btn {
    flex: 1;
    justify-content: center;
  }

  .dashboard-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: 100%;
  }

  .toolbar-actions {
    flex-wrap: wrap;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .package-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .package-docs {
    flex-wrap: wrap;
  }

  .package-meta {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 480px) {
  .header-actions {
    flex-direction: column;
  }

  .cv-table th:not(.col-title):not(.col-actions),
  .cv-table td:not(.col-title):not(.col-actions) {
    display: none;
  }
}

/* ===== Print hide ===== */
@media print {
  .cv-dashboard {
    display: none;
  }
}
'''

with open(TARGET, 'w') as f:
    f.write(CONTENT)
print(f'Written {len(CONTENT)} bytes to {TARGET}')
