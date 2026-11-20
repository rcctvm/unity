# UNITY

Monthly radiotherapy treatment tracker for the **Division of Radiation Physics, Regional Cancer Centre, Thiruvananthapuram**.

This repository contains the UNITY web application, published with GitHub Pages. It holds no patient data and no credentials; all data is stored and served by the UNITY server, whose code is kept in a private repository.

## Features
* **Dashboard**: yearly patients, sittings and down time, with charts by machine and technique
* **Submission status**: which machine and shift reports have been received or are pending for a month
* **Entries**: browse, correct and export to CSV (admins can delete)
* **Monthly report** and **Annual report** (calendar or financial year), printable to PDF
* **New entry**: monthly figures per machine and shift, with duplicate protection (can be shown or hidden in Settings)
* **Settings**: display preferences, user accounts, data sources and import, storage capacity, machines, staff and workload
* **Help**: user manual, inside the application

## Configuration
The server address is set in [`js/config.js`](js/config.js). It does not change between releases.

## Deployment
Every push to `main` publishes the site automatically through GitHub Actions (`.github/workflows/pages.yml`).
