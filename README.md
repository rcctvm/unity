# UNITY

Monthly radiotherapy treatment tracker for the **Division of Radiation Physics, Regional Cancer Centre, Thiruvananthapuram**.

This public repo is the website, served by GitHub Pages. The data and logic live in a private Google Apps Script backend (`rcctvm/unity-code`), which stores everything in the UNITY Google Sheet. This site holds no data and no keys.

## Features
* **Dashboard**: yearly patients, sittings and down time, with charts by machine and technique
* **New entry**: monthly figures per machine and shift. It replaces the Google Form, guards against duplicates and totals patients live.
* **Submission status**: which machine/shift reports are received or pending for a month
* **Entries**: browse, edit and export CSV (admins can delete)
* **Monthly report** and **Annual report** (calendar or financial year): same layout as the legacy sheet, printable to PDF
* **Admin**: machines and shifts, shift-in-charge list, workload, and a read-only import from the legacy sheet

## Configuration
Set the Apps Script web-app URL in [`js/config.js`](js/config.js). It never changes after setup, because the backend CI redeploys the same deployment.

## Deployment
Every push to `main` publishes the site through GitHub Actions (`.github/workflows/pages.yml`). One-time step: Settings → Pages → Source: **GitHub Actions**.
