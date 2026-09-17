# AI-StudyMate Project Documentation

## Overview

AI-StudyMate is organized as a FastAPI backend and a React frontend. The backend owns authentication, retrieval-augmented generation, quizzes, persistence, and service integrations. The frontend owns the user experience and communicates with the backend through API wrappers.

## Repository Layout

The `backend/app` package is divided by responsibility into API routes, core configuration and security, database access, models, schemas, and services. Frontend code is grouped into reusable components, pages, hooks, API wrappers, and context providers.

## Development Status

This repository currently contains the initial application skeleton. Domain behavior, persistence configuration, authentication flows, and UI screens can be added incrementally without changing the top-level layout.
