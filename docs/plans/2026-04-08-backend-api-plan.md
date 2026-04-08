# Philosophy API — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Go backend monolith with file storage, CRUD API for lectures/transcripts, and JWT admin auth.

**Architecture:** Modular monolith with handler → service → repository layers. Storage abstraction with local filesystem implementation. SQLite database. Separate repository `philosophy-api`.

**Tech Stack:** Go 1.23+, chi (router), SQLite (modernc.org/sqlite — pure Go), golang-jwt, bcrypt, slog

---

### Task 1: Project Scaffolding

**Files:**
- Create: `go.mod`
- Create: `cmd/server/main.go`
- Create: `internal/config/config.go`
- Create: `.env.example`
- Create: `Makefile`
- Create: `.gitignore`

**Step 1: Initialize the repository and Go module**

```bash
mkdir philosophy-api && cd philosophy-api
git init
go mod init github.com/<owner>/philosophy-api
```

**Step 2: Create `.gitignore`**

```gitignore
# Binary
/philosophy-api
/tmp

# Data
/data

# Env
.env

# IDE
.idea/
.vscode/
```

**Step 3: Create `.env.example`**

```env
PORT=8080
DATABASE_URL=sqlite://data/philosophy.db
STORAGE_TYPE=local
STORAGE_PATH=./data
JWT_SECRET=change-me-in-production
CORS_ORIGINS=http://localhost:3001
```

**Step 4: Create config loader**

```go
// internal/config/config.go
package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	StorageType string
	StoragePath string
	JWTSecret   string
	CORSOrigins []string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "sqlite://data/philosophy.db"),
		StorageType: getEnv("STORAGE_TYPE", "local"),
		StoragePath: getEnv("STORAGE_PATH", "./data"),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		CORSOrigins: strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3001"), ","),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

**Step 5: Create minimal main.go**

```go
// cmd/server/main.go
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/<owner>/philosophy-api/internal/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	if cfg.JWTSecret == "" {
		slog.Error("JWT_SECRET is required")
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	addr := ":" + cfg.Port
	slog.Info("starting server", "addr", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
```

**Step 6: Create Makefile**

```makefile
.PHONY: build run test migrate create-admin

build:
	go build -o philosophy-api ./cmd/server

run:
	go run ./cmd/server

test:
	go test ./... -v

lint:
	golangci-lint run
```

**Step 7: Verify it runs**

```bash
JWT_SECRET=dev-secret make run
# In another terminal:
curl http://localhost:8080/healthz
# Expected: {"status":"ok"}
```

**Step 8: Commit**

```bash
git add -A
git commit -m "init: project scaffolding with config and health endpoint"
```

---

### Task 2: Database Setup & Migrations

**Files:**
- Create: `internal/database/database.go`
- Create: `migrations/001_init.sql`

**Step 1: Install SQLite driver**

```bash
go get modernc.org/sqlite
```

**Step 2: Create database package**

```go
// internal/database/database.go
package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

func Open(databaseURL string) (*sql.DB, error) {
	// databaseURL format: sqlite://path/to/file.db
	path := strings.TrimPrefix(databaseURL, "sqlite://")

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// Enable WAL mode for better concurrent read performance
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("enable WAL: %w", err)
	}

	return db, nil
}
```

**Step 3: Create initial migration**

```sql
-- migrations/001_init.sql

CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lectures (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date DATETIME NOT NULL,
    video_key TEXT NOT NULL DEFAULT '',
    notes_key TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    lecture_id TEXT NOT NULL UNIQUE,
    segments TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
);
```

**Step 4: Add migration runner to database package**

```go
// internal/database/migrate.go
package database

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
)

func Migrate(db *sql.DB, migrationsDir string) error {
	// Create migrations tracking table
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`); err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.sql"))
	if err != nil {
		return fmt.Errorf("glob migrations: %w", err)
	}
	sort.Strings(files)

	for _, f := range files {
		name := filepath.Base(f)

		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE filename = ?", name).Scan(&count)
		if err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if count > 0 {
			continue
		}

		content, err := os.ReadFile(f)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}

		if _, err := db.Exec("INSERT INTO schema_migrations (filename) VALUES (?)", name); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}

		slog.Info("applied migration", "file", name)
	}

	return nil
}
```

**Step 5: Wire database into main.go**

Update `cmd/server/main.go` to open DB and run migrations on startup:

```go
db, err := database.Open(cfg.DatabaseURL)
if err != nil {
    slog.Error("failed to open database", "error", err)
    os.Exit(1)
}
defer db.Close()

if err := database.Migrate(db, "migrations"); err != nil {
    slog.Error("failed to run migrations", "error", err)
    os.Exit(1)
}
```

**Step 6: Test — verify migrations run**

```bash
JWT_SECRET=dev-secret make run
# Expected log: "applied migration" for 001_init.sql
# data/philosophy.db file should exist
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add SQLite database with migration runner"
```

---

### Task 3: Storage Abstraction + Local Implementation

**Files:**
- Create: `internal/storage/storage.go`
- Create: `internal/storage/local.go`
- Create: `internal/storage/local_test.go`

**Step 1: Write the Storage interface**

```go
// internal/storage/storage.go
package storage

import (
	"context"
	"io"
)

type Storage interface {
	Upload(ctx context.Context, key string, reader io.Reader) error
	Delete(ctx context.Context, key string) error
	GetURL(ctx context.Context, key string) (string, error)
}
```

**Step 2: Write failing test for LocalStorage**

```go
// internal/storage/local_test.go
package storage_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/<owner>/philosophy-api/internal/storage"
)

func TestLocalStorage_Upload_and_GetURL(t *testing.T) {
	dir := t.TempDir()
	baseURL := "/static/files"
	s := storage.NewLocalStorage(dir, baseURL)

	ctx := context.Background()
	key := "videos/test.mp4"
	content := "fake video content"

	err := s.Upload(ctx, key, strings.NewReader(content))
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	// Verify file exists on disk
	data, err := os.ReadFile(filepath.Join(dir, key))
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if string(data) != content {
		t.Fatalf("content mismatch: got %q, want %q", string(data), content)
	}

	// Verify URL
	url, err := s.GetURL(ctx, key)
	if err != nil {
		t.Fatalf("getURL: %v", err)
	}
	if url != baseURL+"/"+key {
		t.Fatalf("url mismatch: got %q, want %q", url, baseURL+"/"+key)
	}
}

func TestLocalStorage_Delete(t *testing.T) {
	dir := t.TempDir()
	s := storage.NewLocalStorage(dir, "/static")

	ctx := context.Background()
	key := "notes/test.docx"

	// Upload first
	err := s.Upload(ctx, key, strings.NewReader("content"))
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	// Delete
	err = s.Delete(ctx, key)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}

	// Verify gone
	_, err = os.Stat(filepath.Join(dir, key))
	if !os.IsNotExist(err) {
		t.Fatal("file should not exist after delete")
	}
}
```

**Step 3: Run test to verify it fails**

```bash
go test ./internal/storage/... -v
# Expected: FAIL — NewLocalStorage not defined
```

**Step 4: Implement LocalStorage**

```go
// internal/storage/local.go
package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type LocalStorage struct {
	basePath string
	baseURL  string
}

func NewLocalStorage(basePath, baseURL string) *LocalStorage {
	return &LocalStorage{basePath: basePath, baseURL: baseURL}
}

func (s *LocalStorage) Upload(_ context.Context, key string, reader io.Reader) error {
	fullPath := filepath.Join(s.basePath, key)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}

	f, err := os.Create(fullPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(f, reader); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	return nil
}

func (s *LocalStorage) Delete(_ context.Context, key string) error {
	fullPath := filepath.Join(s.basePath, key)
	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete file: %w", err)
	}
	return nil
}

func (s *LocalStorage) GetURL(_ context.Context, key string) (string, error) {
	return s.baseURL + "/" + key, nil
}
```

**Step 5: Run tests to verify they pass**

```bash
go test ./internal/storage/... -v
# Expected: PASS
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add storage interface and local filesystem implementation"
```

---

### Task 4: Auth — Admin Model, Repository, Service

**Files:**
- Create: `internal/auth/model.go`
- Create: `internal/auth/repo.go`
- Create: `internal/auth/service.go`
- Create: `internal/auth/service_test.go`

**Step 1: Create admin model**

```go
// internal/auth/model.go
package auth

import "time"

type Admin struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}
```

**Step 2: Create repository**

```go
// internal/auth/repo.go
package auth

import (
	"database/sql"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(admin *Admin) error {
	_, err := r.db.Exec(
		"INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?)",
		admin.ID, admin.Username, admin.PasswordHash,
	)
	if err != nil {
		return fmt.Errorf("create admin: %w", err)
	}
	return nil
}

func (r *Repository) GetByUsername(username string) (*Admin, error) {
	row := r.db.QueryRow(
		"SELECT id, username, password_hash, created_at FROM admins WHERE username = ?",
		username,
	)
	a := &Admin{}
	if err := row.Scan(&a.ID, &a.Username, &a.PasswordHash, &a.CreatedAt); err != nil {
		return nil, fmt.Errorf("get admin: %w", err)
	}
	return a, nil
}
```

**Step 3: Write failing test for auth service**

```go
// internal/auth/service_test.go
package auth_test

import (
	"testing"

	"github.com/<owner>/philosophy-api/internal/auth"
	"github.com/<owner>/philosophy-api/internal/database"
)

func setupTestDB(t *testing.T) *auth.Service {
	t.Helper()
	db, err := database.Open("sqlite://" + t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	repo := auth.NewRepository(db)
	return auth.NewService(repo, "test-jwt-secret")
}

func TestService_CreateAndLogin(t *testing.T) {
	svc := setupTestDB(t)

	err := svc.CreateAdmin("admin", "password123")
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}

	token, err := svc.Login("admin", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestService_LoginWrongPassword(t *testing.T) {
	svc := setupTestDB(t)

	_ = svc.CreateAdmin("admin", "password123")

	_, err := svc.Login("admin", "wrong")
	if err == nil {
		t.Fatal("expected error for wrong password")
	}
}
```

**Step 4: Run test to verify it fails**

```bash
go test ./internal/auth/... -v
# Expected: FAIL — NewService not defined
```

**Step 5: Implement auth service**

```go
// internal/auth/service.go
package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo      *Repository
	jwtSecret string
}

func NewService(repo *Repository, jwtSecret string) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret}
}

func (s *Service) CreateAdmin(username, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	admin := &Admin{
		ID:           uuid.New().String(),
		Username:     username,
		PasswordHash: string(hash),
	}
	return s.repo.Create(admin)
}

func (s *Service) Login(username, password string) (string, error) {
	admin, err := s.repo.GetByUsername(username)
	if err != nil {
		return "", fmt.Errorf("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
		return "", fmt.Errorf("invalid credentials")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"admin_id": admin.ID,
		"username": admin.Username,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})

	return token.SignedString([]byte(s.jwtSecret))
}
```

**Step 6: Install dependencies and run tests**

```bash
go get github.com/golang-jwt/jwt/v5
go get github.com/google/uuid
go get golang.org/x/crypto/bcrypt
go test ./internal/auth/... -v
# Expected: PASS
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add auth with admin model, repository, service, and JWT"
```

---

### Task 5: Auth — JWT Middleware & Login Handler

**Files:**
- Create: `internal/middleware/auth.go`
- Create: `internal/auth/handler.go`
- Create: `internal/auth/handler_test.go`

**Step 1: Create JWT middleware**

```go
// internal/middleware/auth.go
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const AdminIDKey contextKey = "admin_id"

func RequireAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				http.Error(w, `{"error":"unauthorized","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"unauthorized","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"unauthorized","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), AdminIDKey, claims["admin_id"])
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
```

**Step 2: Write failing test for login handler**

```go
// internal/auth/handler_test.go
package auth_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/<owner>/philosophy-api/internal/auth"
	"github.com/<owner>/philosophy-api/internal/database"
)

func setupHandlerTest(t *testing.T) *auth.Handler {
	t.Helper()
	db, err := database.Open("sqlite://" + t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	repo := auth.NewRepository(db)
	svc := auth.NewService(repo, "test-secret")
	_ = svc.CreateAdmin("admin", "pass123")

	return auth.NewHandler(svc)
}

func TestHandler_Login_Success(t *testing.T) {
	h := setupHandlerTest(t)

	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "pass123"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]string
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["token"] == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestHandler_Login_WrongPassword(t *testing.T) {
	h := setupHandlerTest(t)

	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "wrong"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}
```

**Step 3: Run test to verify it fails**

```bash
go test ./internal/auth/... -v
# Expected: FAIL — NewHandler not defined
```

**Step 4: Implement login handler**

```go
// internal/auth/handler.go
package auth

import (
	"encoding/json"
	"net/http"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body", "BAD_REQUEST")
		return
	}

	token, err := h.service.Login(req.Username, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials", "UNAUTHORIZED")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message, code string) {
	writeJSON(w, status, map[string]string{"error": message, "code": code})
}
```

**Step 5: Run tests**

```bash
go test ./internal/auth/... -v
# Expected: PASS
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add JWT middleware and login handler"
```

---

### Task 6: Lecture — Model, Repository, Service

**Files:**
- Create: `internal/lecture/model.go`
- Create: `internal/lecture/repo.go`
- Create: `internal/lecture/service.go`
- Create: `internal/lecture/service_test.go`

**Step 1: Create lecture model**

```go
// internal/lecture/model.go
package lecture

import "time"

type Lecture struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Date        time.Time `json:"date"`
	VideoKey    string    `json:"-"`
	NotesKey    string    `json:"-"`
	VideoURL    string    `json:"video_url,omitempty"`
	NotesURL    string    `json:"notes_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
```

**Step 2: Create repository**

```go
// internal/lecture/repo.go
package lecture

import (
	"database/sql"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(l *Lecture) error {
	_, err := r.db.Exec(
		`INSERT INTO lectures (id, title, description, date, video_key, notes_key)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		l.ID, l.Title, l.Description, l.Date, l.VideoKey, l.NotesKey,
	)
	if err != nil {
		return fmt.Errorf("create lecture: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(id string) (*Lecture, error) {
	row := r.db.QueryRow(
		`SELECT id, title, description, date, video_key, notes_key, created_at, updated_at
		 FROM lectures WHERE id = ?`, id,
	)
	l := &Lecture{}
	if err := row.Scan(&l.ID, &l.Title, &l.Description, &l.Date, &l.VideoKey, &l.NotesKey, &l.CreatedAt, &l.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get lecture: %w", err)
	}
	return l, nil
}

func (r *Repository) List() ([]*Lecture, error) {
	rows, err := r.db.Query(
		`SELECT id, title, description, date, video_key, notes_key, created_at, updated_at
		 FROM lectures ORDER BY date DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("list lectures: %w", err)
	}
	defer rows.Close()

	var lectures []*Lecture
	for rows.Next() {
		l := &Lecture{}
		if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Date, &l.VideoKey, &l.NotesKey, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan lecture: %w", err)
		}
		lectures = append(lectures, l)
	}
	return lectures, nil
}

func (r *Repository) Update(l *Lecture) error {
	_, err := r.db.Exec(
		`UPDATE lectures SET title=?, description=?, date=?, video_key=?, notes_key=?, updated_at=CURRENT_TIMESTAMP
		 WHERE id=?`,
		l.Title, l.Description, l.Date, l.VideoKey, l.NotesKey, l.ID,
	)
	if err != nil {
		return fmt.Errorf("update lecture: %w", err)
	}
	return nil
}

func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM lectures WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete lecture: %w", err)
	}
	return nil
}
```

**Step 3: Write failing test for lecture service**

```go
// internal/lecture/service_test.go
package lecture_test

import (
	"context"
	"testing"

	"github.com/<owner>/philosophy-api/internal/database"
	"github.com/<owner>/philosophy-api/internal/lecture"
	"github.com/<owner>/philosophy-api/internal/storage"
)

func setupTestService(t *testing.T) *lecture.Service {
	t.Helper()
	db, err := database.Open("sqlite://" + t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	repo := lecture.NewRepository(db)
	store := storage.NewLocalStorage(t.TempDir(), "/static")
	return lecture.NewService(repo, store)
}

func TestService_CreateAndGet(t *testing.T) {
	svc := setupTestService(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, lecture.CreateRequest{
		Title:       "Кант. Критика чистого разума",
		Description: "Лекция 1",
		Date:        "2026-04-01",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := svc.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Title != "Кант. Критика чистого разума" {
		t.Fatalf("title mismatch: %q", got.Title)
	}
}

func TestService_List(t *testing.T) {
	svc := setupTestService(t)
	ctx := context.Background()

	_, _ = svc.Create(ctx, lecture.CreateRequest{Title: "Лекция 1", Date: "2026-04-01"})
	_, _ = svc.Create(ctx, lecture.CreateRequest{Title: "Лекция 2", Date: "2026-04-02"})

	list, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 lectures, got %d", len(list))
	}
}

func TestService_Delete(t *testing.T) {
	svc := setupTestService(t)
	ctx := context.Background()

	created, _ := svc.Create(ctx, lecture.CreateRequest{Title: "Delete me", Date: "2026-04-01"})
	err := svc.Delete(ctx, created.ID)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}

	_, err = svc.GetByID(ctx, created.ID)
	if err == nil {
		t.Fatal("expected error after delete")
	}
}
```

**Step 4: Run test to verify it fails**

```bash
go test ./internal/lecture/... -v
# Expected: FAIL — NewService, CreateRequest not defined
```

**Step 5: Implement lecture service**

```go
// internal/lecture/service.go
package lecture

import (
	"context"
	"fmt"
	"time"

	"github.com/<owner>/philosophy-api/internal/storage"
	"github.com/google/uuid"
)

type Service struct {
	repo    *Repository
	storage storage.Storage
}

func NewService(repo *Repository, storage storage.Storage) *Service {
	return &Service{repo: repo, storage: storage}
}

type CreateRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Date        string `json:"date"`
}

type UpdateRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Date        *string `json:"date"`
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (*Lecture, error) {
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date: %w", err)
	}

	l := &Lecture{
		ID:          uuid.New().String(),
		Title:       req.Title,
		Description: req.Description,
		Date:        date,
	}

	if err := s.repo.Create(l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *Service) GetByID(ctx context.Context, id string) (*Lecture, error) {
	l, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	s.resolveURLs(ctx, l)
	return l, nil
}

func (s *Service) List(ctx context.Context) ([]*Lecture, error) {
	lectures, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	for _, l := range lectures {
		s.resolveURLs(ctx, l)
	}
	return lectures, nil
}

func (s *Service) Update(ctx context.Context, id string, req UpdateRequest) (*Lecture, error) {
	l, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Title != nil {
		l.Title = *req.Title
	}
	if req.Description != nil {
		l.Description = *req.Description
	}
	if req.Date != nil {
		date, err := time.Parse("2006-01-02", *req.Date)
		if err != nil {
			return nil, fmt.Errorf("invalid date: %w", err)
		}
		l.Date = date
	}

	if err := s.repo.Update(l); err != nil {
		return nil, err
	}
	s.resolveURLs(ctx, l)
	return l, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	l, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	if l.VideoKey != "" {
		_ = s.storage.Delete(ctx, l.VideoKey)
	}
	if l.NotesKey != "" {
		_ = s.storage.Delete(ctx, l.NotesKey)
	}

	return s.repo.Delete(id)
}

func (s *Service) resolveURLs(ctx context.Context, l *Lecture) {
	if l.VideoKey != "" {
		l.VideoURL, _ = s.storage.GetURL(ctx, l.VideoKey)
	}
	if l.NotesKey != "" {
		l.NotesURL, _ = s.storage.GetURL(ctx, l.NotesKey)
	}
}
```

**Step 6: Run tests**

```bash
go test ./internal/lecture/... -v
# Expected: PASS
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add lecture model, repository, and service with CRUD"
```

---

### Task 7: Lecture — HTTP Handlers

**Files:**
- Create: `internal/lecture/handler.go`
- Create: `internal/lecture/handler_test.go`

**Step 1: Write failing test for lecture handlers**

```go
// internal/lecture/handler_test.go
package lecture_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/<owner>/philosophy-api/internal/database"
	"github.com/<owner>/philosophy-api/internal/lecture"
	"github.com/<owner>/philosophy-api/internal/storage"
)

func setupHandlerTest(t *testing.T) *lecture.Handler {
	t.Helper()
	db, err := database.Open("sqlite://" + t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	repo := lecture.NewRepository(db)
	store := storage.NewLocalStorage(t.TempDir(), "/static")
	svc := lecture.NewService(repo, store)
	return lecture.NewHandler(svc)
}

func TestHandler_CreateAndList(t *testing.T) {
	h := setupHandlerTest(t)

	// Create
	body, _ := json.Marshal(lecture.CreateRequest{
		Title: "Test Lecture", Date: "2026-04-01",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/lectures", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.Create(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	// List
	req = httptest.NewRequest(http.MethodGet, "/api/lectures", nil)
	rec = httptest.NewRecorder()
	h.List(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", rec.Code)
	}

	var list []*lecture.Lecture
	json.NewDecoder(rec.Body).Decode(&list)
	if len(list) != 1 {
		t.Fatalf("expected 1 lecture, got %d", len(list))
	}
}
```

**Step 2: Run test to verify it fails**

```bash
go test ./internal/lecture/... -v -run TestHandler
# Expected: FAIL — NewHandler not defined
```

**Step 3: Implement lecture handler**

```go
// internal/lecture/handler.go
package lecture

import (
	"encoding/json"
	"net/http"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body", "BAD_REQUEST")
		return
	}

	l, err := h.service.Create(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	writeJSON(w, http.StatusCreated, l)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	lectures, err := h.service.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, lectures)
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	l, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "lecture not found", "NOT_FOUND")
		return
	}
	writeJSON(w, http.StatusOK, l)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req UpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body", "BAD_REQUEST")
		return
	}

	l, err := h.service.Update(r.Context(), id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, l)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.service.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message, code string) {
	writeJSON(w, status, map[string]string{"error": message, "code": code})
}
```

**Step 4: Run tests**

```bash
go test ./internal/lecture/... -v
# Expected: PASS
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add lecture HTTP handlers"
```

---

### Task 8: Transcript — Model, Repository, Service, Handler

**Files:**
- Create: `internal/transcript/model.go`
- Create: `internal/transcript/repo.go`
- Create: `internal/transcript/service.go`
- Create: `internal/transcript/handler.go`
- Create: `internal/transcript/service_test.go`

**Step 1: Create transcript model**

```go
// internal/transcript/model.go
package transcript

import "time"

type Segment struct {
	ID      int     `json:"id"`
	Start   float64 `json:"start"`
	End     float64 `json:"end"`
	Speaker string  `json:"speaker"`
	Text    string  `json:"text"`
}

type Transcript struct {
	ID        string    `json:"id"`
	LectureID string    `json:"lecture_id"`
	Segments  []Segment `json:"segments"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
```

**Step 2: Create repository**

```go
// internal/transcript/repo.go
package transcript

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Upsert(t *Transcript) error {
	segmentsJSON, err := json.Marshal(t.Segments)
	if err != nil {
		return fmt.Errorf("marshal segments: %w", err)
	}

	_, err = r.db.Exec(
		`INSERT INTO transcripts (id, lecture_id, segments)
		 VALUES (?, ?, ?)
		 ON CONFLICT(lecture_id) DO UPDATE SET segments=excluded.segments, updated_at=CURRENT_TIMESTAMP`,
		t.ID, t.LectureID, string(segmentsJSON),
	)
	if err != nil {
		return fmt.Errorf("upsert transcript: %w", err)
	}
	return nil
}

func (r *Repository) GetByLectureID(lectureID string) (*Transcript, error) {
	row := r.db.QueryRow(
		`SELECT id, lecture_id, segments, created_at, updated_at
		 FROM transcripts WHERE lecture_id = ?`, lectureID,
	)
	t := &Transcript{}
	var segmentsJSON string
	if err := row.Scan(&t.ID, &t.LectureID, &segmentsJSON, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get transcript: %w", err)
	}
	if err := json.Unmarshal([]byte(segmentsJSON), &t.Segments); err != nil {
		return nil, fmt.Errorf("unmarshal segments: %w", err)
	}
	return t, nil
}
```

**Step 3: Write failing test for transcript service**

```go
// internal/transcript/service_test.go
package transcript_test

import (
	"context"
	"testing"

	"github.com/<owner>/philosophy-api/internal/database"
	"github.com/<owner>/philosophy-api/internal/lecture"
	"github.com/<owner>/philosophy-api/internal/storage"
	"github.com/<owner>/philosophy-api/internal/transcript"
)

func setupTest(t *testing.T) (*transcript.Service, string) {
	t.Helper()
	db, err := database.Open("sqlite://" + t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	// Create a lecture first
	lectRepo := lecture.NewRepository(db)
	store := storage.NewLocalStorage(t.TempDir(), "/static")
	lectSvc := lecture.NewService(lectRepo, store)
	lect, _ := lectSvc.Create(context.Background(), lecture.CreateRequest{
		Title: "Test", Date: "2026-04-01",
	})

	repo := transcript.NewRepository(db)
	svc := transcript.NewService(repo)
	return svc, lect.ID
}

func TestService_UpsertAndGet(t *testing.T) {
	svc, lectureID := setupTest(t)
	ctx := context.Background()

	segments := []transcript.Segment{
		{ID: 1, Start: 0.0, End: 5.0, Speaker: "Преподаватель", Text: "Привет"},
		{ID: 2, Start: 5.0, End: 10.0, Speaker: "Студент", Text: "Здравствуйте"},
	}

	err := svc.Upsert(ctx, lectureID, segments)
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}

	got, err := svc.GetByLectureID(ctx, lectureID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(got.Segments) != 2 {
		t.Fatalf("expected 2 segments, got %d", len(got.Segments))
	}
	if got.Segments[0].Text != "Привет" {
		t.Fatalf("text mismatch: %q", got.Segments[0].Text)
	}
}
```

**Step 4: Run test to verify it fails**

```bash
go test ./internal/transcript/... -v
# Expected: FAIL — NewService not defined
```

**Step 5: Implement transcript service**

```go
// internal/transcript/service.go
package transcript

import (
	"context"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Upsert(ctx context.Context, lectureID string, segments []Segment) error {
	t := &Transcript{
		ID:        uuid.New().String(),
		LectureID: lectureID,
		Segments:  segments,
	}
	return s.repo.Upsert(t)
}

func (s *Service) GetByLectureID(ctx context.Context, lectureID string) (*Transcript, error) {
	return s.repo.GetByLectureID(lectureID)
}
```

**Step 6: Run tests**

```bash
go test ./internal/transcript/... -v
# Expected: PASS
```

**Step 7: Implement transcript handler**

```go
// internal/transcript/handler.go
package transcript

import (
	"encoding/json"
	"net/http"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetByLectureID(w http.ResponseWriter, r *http.Request) {
	lectureID := r.PathValue("id")
	t, err := h.service.GetByLectureID(r.Context(), lectureID)
	if err != nil {
		writeError(w, http.StatusNotFound, "transcript not found", "NOT_FOUND")
		return
	}
	writeJSON(w, http.StatusOK, t)
}

type upsertRequest struct {
	Segments []Segment `json:"segments"`
}

func (h *Handler) Upsert(w http.ResponseWriter, r *http.Request) {
	lectureID := r.PathValue("id")
	var req upsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body", "BAD_REQUEST")
		return
	}

	if err := h.service.Upsert(r.Context(), lectureID, req.Segments); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message, code string) {
	writeJSON(w, status, map[string]string{"error": message, "code": code})
}
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add transcript model, repository, service, and handler"
```

---

### Task 9: File Upload Handler

**Files:**
- Create: `internal/upload/handler.go`
- Create: `internal/upload/handler_test.go`

**Step 1: Write failing test for upload handler**

```go
// internal/upload/handler_test.go
package upload_test

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/<owner>/philosophy-api/internal/storage"
	"github.com/<owner>/philosophy-api/internal/upload"
)

func TestHandler_Upload(t *testing.T) {
	dir := t.TempDir()
	store := storage.NewLocalStorage(dir, "/static")
	h := upload.NewHandler(store)

	// Build multipart request
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.WriteField("type", "videos")
	w.WriteField("lecture_id", "abc-123")
	fw, _ := w.CreateFormFile("file", "lecture.mp4")
	fw.Write([]byte("fake video"))
	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/upload", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rec := httptest.NewRecorder()

	h.Upload(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
```

**Step 2: Run test to verify it fails**

```bash
go test ./internal/upload/... -v
# Expected: FAIL — NewHandler not defined
```

**Step 3: Implement upload handler**

```go
// internal/upload/handler.go
package upload

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"

	"github.com/<owner>/philosophy-api/internal/storage"
)

type Handler struct {
	storage storage.Storage
}

func NewHandler(storage storage.Storage) *Handler {
	return &Handler{storage: storage}
}

// Upload accepts multipart form with fields: type (videos|notes|transcripts), lecture_id, file
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(512 << 20); err != nil { // 512MB max
		writeError(w, http.StatusBadRequest, "invalid multipart form", "BAD_REQUEST")
		return
	}

	fileType := r.FormValue("type")
	lectureID := r.FormValue("lecture_id")

	if fileType == "" || lectureID == "" {
		writeError(w, http.StatusBadRequest, "type and lecture_id are required", "BAD_REQUEST")
		return
	}

	if fileType != "videos" && fileType != "notes" && fileType != "transcripts" {
		writeError(w, http.StatusBadRequest, "type must be videos, notes, or transcripts", "BAD_REQUEST")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required", "BAD_REQUEST")
		return
	}
	defer file.Close()

	ext := filepath.Ext(header.Filename)
	key := fmt.Sprintf("%s/%s%s", fileType, lectureID, ext)

	if err := h.storage.Upload(r.Context(), key, file); err != nil {
		writeError(w, http.StatusInternalServerError, "upload failed", "INTERNAL")
		return
	}

	url, _ := h.storage.GetURL(r.Context(), key)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"key": key, "url": url})
}

func writeError(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message, "code": code})
}
```

**Step 4: Run tests**

```bash
go test ./internal/upload/... -v
# Expected: PASS
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add file upload handler with multipart support"
```

---

### Task 10: CLI — create-admin Command

**Files:**
- Modify: `cmd/server/main.go`

**Step 1: Add CLI flag parsing to main.go**

Update main.go to support subcommands:

```go
// cmd/server/main.go
package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/<owner>/philosophy-api/internal/auth"
	"github.com/<owner>/philosophy-api/internal/config"
	"github.com/<owner>/philosophy-api/internal/database"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	if len(os.Args) > 1 && os.Args[1] == "create-admin" {
		createAdmin(cfg)
		return
	}

	serve(cfg)
}

func createAdmin(cfg *config.Config) {
	if len(os.Args) < 6 {
		fmt.Println("Usage: philosophy-api create-admin --username <name> --password <pass>")
		os.Exit(1)
	}

	var username, password string
	for i := 2; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--username":
			i++
			username = os.Args[i]
		case "--password":
			i++
			password = os.Args[i]
		}
	}

	if username == "" || password == "" {
		fmt.Println("--username and --password are required")
		os.Exit(1)
	}

	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.Migrate(db, "migrations"); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	repo := auth.NewRepository(db)
	svc := auth.NewService(repo, cfg.JWTSecret)

	if err := svc.CreateAdmin(username, password); err != nil {
		slog.Error("failed to create admin", "error", err)
		os.Exit(1)
	}

	fmt.Printf("Admin %q created successfully\n", username)
}

func serve(cfg *config.Config) {
	// ... server setup (Task 11)
}
```

**Step 2: Test manually**

```bash
JWT_SECRET=dev-secret go run ./cmd/server create-admin --username admin --password secret123
# Expected: Admin "admin" created successfully
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add create-admin CLI command"
```

---

### Task 11: Wire Everything — Router & Server

**Files:**
- Modify: `cmd/server/main.go`
- Create: `internal/middleware/cors.go`
- Create: `internal/middleware/recovery.go`
- Create: `internal/middleware/logging.go`

**Step 1: Create CORS middleware**

```go
// internal/middleware/cors.go
package middleware

import "net/http"

func CORS(origins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool)
	for _, o := range origins {
		allowed[o] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if allowed[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

**Step 2: Create recovery middleware**

```go
// internal/middleware/recovery.go
package middleware

import (
	"log/slog"
	"net/http"
)

func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic recovered", "error", err, "path", r.URL.Path)
				http.Error(w, `{"error":"internal server error","code":"INTERNAL"}`, http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
```

**Step 3: Create logging middleware**

```go
// internal/middleware/logging.go
package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"duration", time.Since(start).String(),
		)
	})
}
```

**Step 4: Wire the full router in main.go serve()**

```go
func serve(cfg *config.Config) {
	if cfg.JWTSecret == "" {
		slog.Error("JWT_SECRET is required")
		os.Exit(1)
	}

	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.Migrate(db, "migrations"); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Storage
	var store storage.Storage
	switch cfg.StorageType {
	case "local":
		store = storage.NewLocalStorage(cfg.StoragePath, "/static/files")
	default:
		slog.Error("unsupported storage type", "type", cfg.StorageType)
		os.Exit(1)
	}

	// Services
	authRepo := auth.NewRepository(db)
	authSvc := auth.NewService(authRepo, cfg.JWTSecret)
	authHandler := auth.NewHandler(authSvc)

	lectRepo := lecture.NewRepository(db)
	lectSvc := lecture.NewService(lectRepo, store)
	lectHandler := lecture.NewHandler(lectSvc)

	transcriptRepo := transcript.NewRepository(db)
	transcriptSvc := transcript.NewService(transcriptRepo)
	transcriptHandler := transcript.NewHandler(transcriptSvc)

	uploadHandler := upload.NewHandler(store)

	// Router
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public
	mux.HandleFunc("GET /api/lectures", lectHandler.List)
	mux.HandleFunc("GET /api/lectures/{id}", lectHandler.GetByID)
	mux.HandleFunc("GET /api/lectures/{id}/transcript", transcriptHandler.GetByLectureID)

	// Admin (auth required)
	adminAuth := middleware.RequireAuth(cfg.JWTSecret)
	mux.HandleFunc("POST /api/admin/auth/login", authHandler.Login)
	mux.Handle("POST /api/admin/lectures", adminAuth(http.HandlerFunc(lectHandler.Create)))
	mux.Handle("PUT /api/admin/lectures/{id}", adminAuth(http.HandlerFunc(lectHandler.Update)))
	mux.Handle("DELETE /api/admin/lectures/{id}", adminAuth(http.HandlerFunc(lectHandler.Delete)))
	mux.Handle("POST /api/admin/lectures/{id}/transcript", adminAuth(http.HandlerFunc(transcriptHandler.Upsert)))
	mux.Handle("POST /api/admin/upload", adminAuth(http.HandlerFunc(uploadHandler.Upload)))

	// Static files (for local storage in dev)
	mux.Handle("/static/files/", http.StripPrefix("/static/files/", http.FileServer(http.Dir(cfg.StoragePath))))

	// Middleware chain
	handler := middleware.Recovery(
		middleware.Logging(
			middleware.CORS(cfg.CORSOrigins)(mux),
		),
	)

	addr := ":" + cfg.Port
	slog.Info("starting server", "addr", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
```

**Step 5: Run all tests**

```bash
make test
# Expected: all PASS
```

**Step 6: Manual smoke test**

```bash
JWT_SECRET=dev-secret make run
# Terminal 2:
curl http://localhost:8080/healthz
curl http://localhost:8080/api/lectures
curl -X POST http://localhost:8080/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"secret123"}'
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire router with all handlers, middleware, and static file serving"
```

---

### Task 12: Dockerfile & docker-compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx/default.conf`

**Step 1: Create Dockerfile**

```dockerfile
# Dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o philosophy-api ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/philosophy-api .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
ENTRYPOINT ["./philosophy-api"]
```

**Step 2: Create nginx config**

```nginx
# nginx/default.conf
server {
    listen 80;

    location /static/files/ {
        alias /data/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Step 3: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    env_file: .env

  nginx:
    image: nginx:alpine
    ports:
      - "8081:80"
    volumes:
      - ./data:/data:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

**Step 4: Verify build**

```bash
docker build -t philosophy-api .
# Expected: successful build
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Dockerfile, docker-compose, and nginx config"
```

---

## Summary

| Task | Описание | Тесты |
|------|----------|-------|
| 1 | Scaffolding: go.mod, config, main, Makefile | manual |
| 2 | Database: SQLite, migrations | manual |
| 3 | Storage: интерфейс + LocalStorage | unit |
| 4 | Auth: model, repo, service | unit |
| 5 | Auth: JWT middleware, login handler | integration |
| 6 | Lecture: model, repo, service | unit |
| 7 | Lecture: HTTP handlers | integration |
| 8 | Transcript: model, repo, service, handler | unit |
| 9 | Upload: file upload handler | unit |
| 10 | CLI: create-admin command | manual |
| 11 | Router: wire everything together | integration |
| 12 | Docker: Dockerfile, compose, nginx | manual |
