package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

var (
	ErrCategoryHasChildren     = errors.New("category has child categories")
	ErrCategoryHasTransactions = errors.New("category has transactions")
)

type categoryStore interface {
	CreateCategory(ctx context.Context, arg store.CreateCategoryParams) (store.Category, error)
	ListCategories(ctx context.Context, userID uuid.UUID) ([]store.ListCategoriesRow, error)
	UpdateCategory(ctx context.Context, arg store.UpdateCategoryParams) (store.Category, error)
	DeleteCategory(ctx context.Context, arg store.DeleteCategoryParams) error
	HasChildCategories(ctx context.Context, parentID pgtype.UUID) (bool, error)
	HasCategoryTransactions(ctx context.Context, categoryID pgtype.UUID) (bool, error)
}

type Category struct {
	queries categoryStore
}

func NewCategory(queries *store.Queries) *Category {
	return &Category{queries: queries}
}

func (s *Category) Create(ctx context.Context, userID uuid.UUID, req dto.CreateCategoryRequest) (*dto.CategoryResponse, error) {
	cat, err := s.queries.CreateCategory(ctx, store.CreateCategoryParams{
		UserID:   userID,
		ParentID: uuidToNullable(req.ParentID),
		Name:     req.Name,
		Type:     req.Type,
	})
	if err != nil {
		return nil, err
	}
	return catToResponse(cat), nil
}

func (s *Category) List(ctx context.Context, userID uuid.UUID) ([]dto.CategoryResponse, error) {
	cats, err := s.queries.ListCategories(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Build tree: parents with nested children
	parentMap := make(map[uuid.UUID]*dto.CategoryResponse)
	var rootOrder []uuid.UUID

	// First pass: collect parents
	for _, c := range cats {
		r := listCatToResponse(c)
		if r.ParentID == nil {
			parentMap[r.ID] = r
			rootOrder = append(rootOrder, r.ID)
		}
	}

	// Second pass: attach children
	var orphans []dto.CategoryResponse
	for _, c := range cats {
		r := listCatToResponse(c)
		if r.ParentID != nil {
			if parent, ok := parentMap[*r.ParentID]; ok {
				parent.Children = append(parent.Children, *r)
			} else {
				orphans = append(orphans, *r)
			}
		}
	}

	// Build result in original order
	roots := make([]dto.CategoryResponse, 0, len(rootOrder)+len(orphans))
	for _, id := range rootOrder {
		roots = append(roots, *parentMap[id])
	}
	roots = append(roots, orphans...)
	return roots, nil
}

func (s *Category) Update(ctx context.Context, userID, categoryID uuid.UUID, req dto.UpdateCategoryRequest) (*dto.CategoryResponse, error) {
	cat, err := s.queries.UpdateCategory(ctx, store.UpdateCategoryParams{
		ID:       categoryID,
		Name:     req.Name,
		ParentID: uuidToNullable(req.ParentID),
		UserID:   userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return catToResponse(cat), nil
}

func (s *Category) Delete(ctx context.Context, userID, categoryID uuid.UUID) error {
	pgID := pgtype.UUID{Bytes: categoryID, Valid: true}

	hasChildren, err := s.queries.HasChildCategories(ctx, pgID)
	if err != nil {
		return err
	}
	if hasChildren {
		return ErrCategoryHasChildren
	}

	hasTxns, err := s.queries.HasCategoryTransactions(ctx, pgID)
	if err != nil {
		return err
	}
	if hasTxns {
		return ErrCategoryHasTransactions
	}

	return s.queries.DeleteCategory(ctx, store.DeleteCategoryParams{ID: categoryID, UserID: userID})
}

func listCatToResponse(c store.ListCategoriesRow) *dto.CategoryResponse {
	return &dto.CategoryResponse{
		ID:            c.ID,
		Name:          c.Name,
		Type:          c.Type,
		ParentID:      nullableToUUID(c.ParentID),
		RecentTxCount: int(c.RecentTxCount),
		CreatedAt:     c.CreatedAt.Time,
	}
}

func catToResponse(c store.Category) *dto.CategoryResponse {
	return &dto.CategoryResponse{
		ID:        c.ID,
		Name:      c.Name,
		Type:      c.Type,
		ParentID:  nullableToUUID(c.ParentID),
		CreatedAt: c.CreatedAt.Time,
	}
}
