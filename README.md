# P09 – Heard in Class, Lost After #

## Project Overview
A Faculty–Student Communication System designed to help students resolve academic doubts and requests outside the classroom. It provides a structured platform for submitting queries, managing faculty responses, and scheduling appointments.

## Modules

- **Module 1 – Student Query Service:** Students can submit academic questions and requests with course and context details.
- **Module 2 – Faculty Response Service:** Faculty can view, prioritise, answer queries, and schedule office-hour responses.
- **Module 3 – Triage & Appointment Service:** Automatically categorises queries, assigns priorities, routes them to appropriate faculty, and manages appointments.

## Workflow
Student Query → Triage & Routing → Faculty Response / Appointment

## Key Features
- Structured student query submission.
- Automatic query categorisation and prioritisation.
- Faculty-based query routing.
- Faculty response and appointment scheduling.
- JSON-based data storage.

## Installation & Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the application in your browser:

   ```text
   http://localhost:3000
   ```

## Project Structure

- `/student` – Module 1: Submit academic queries.
- `/faculty` – Module 2: View, answer, and schedule queries.
- `lib/triage.js` – Module 3: Query categorisation, prioritisation, and faculty routing.
- `data/queries.json` – Stores query data automatically.

## Purpose
To reduce communication gaps between students and faculty by providing a centralised, organised, and efficient query management system.
