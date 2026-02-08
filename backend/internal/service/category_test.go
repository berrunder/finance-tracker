package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type mockCategoryStore struct {
	createCategoryFn         func(ctx context.Context, arg store.CreateCategoryParams) (store.Category, error)
	listCategoriesFn         func(ctx context.Context, userID uuid.UUID) ([]store.Category, error)
	updateCategoryFn         func(ctx context.Context, arg store.UpdateCategoryParams) (store.Category, error)
	deleteCategoryFn         func(ctx context.Context, arg store.DeleteCategoryParams) error
	hasChildCategoriesFn     func(ctx context.Context, parentID pgtype.UUID) (bool, error)
	hasCategoryTransactionsFn func(ctx context.Context, categoryID pgtype.UUID) (bool, error)
}

func (m *mockCategoryStore) CreateCategory(ctx context.Context, arg store.CreateCategoryParams) (store.Category, error) {
	return m.createCategoryFn(ctx, arg)
}
func (m *mockCategoryStore) ListCategories(ctx context.Context, userID uuid.UUID) ([]store.Category, error) {
	return m.listCategoriesFn(ctx, userID)
}
func (m *mockCategoryStore) UpdateCategory(ctx context.Context, arg store.UpdateCategoryParams) (store.Category, error) {
	return m.updateCategoryFn(ctx, arg)
}
func (m *mockCategoryStore) DeleteCategory(ctx context.Context, arg store.DeleteCategoryParams) error {
	return m.deleteCategoryFn(ctx, arg)
}
func (m *mockCategoryStore) HasChildCategories(ctx context.Context, parentID pgtype.UUID) (bool, error) {
	return m.hasChildCategoriesFn(ctx, parentID)
}
func (m *mockCategoryStore) HasCategoryTransactions(ctx context.Context, categoryID pgtype.UUID) (bool, error) {
	return m.hasCategoryTransactionsFn(ctx, categoryID)
}

func TestCategoryList_Tree(t *testing.T) {
	userID := uuid.New()
	parentID := uuid.New()
	childID := uuid.New()

	mock := &mockCategoryStore{
		listCategoriesFn: func(ctx context.Context, uid uuid.UUID) ([]store.Category, error) {
			return []store.Category{
				{ID: parentID, UserID: userID, Name: "Food", Type: "expense", ParentID: pgtype.UUID{Valid: false}, CreatedAt: makeTimestamp()},
				{ID: childID, UserID: userID, Name: "Groceries", Type: "expense", ParentID: pgtype.UUID{Bytes: parentID, Valid: true}, CreatedAt: makeTimestamp()},
			}, nil
		},
	}

	svc := &Category{queries: mock}
	result, err := svc.List(context.Background(), userID)

	require.NoError(t, err)
	require.Len(t, result, 1)
	require.Equal(t, "Food", result[0].Name)
	require.Len(t, result[0].Children, 1)
	require.Equal(t, "Groceries", result[0].Children[0].Name)
}

func TestCategoryList_Empty(t *testing.T) {
	mock := &mockCategoryStore{
		listCategoriesFn: func(ctx context.Context, uid uuid.UUID) ([]store.Category, error) {
			return []store.Category{}, nil
		},
	}

	svc := &Category{queries: mock}
	result, err := svc.List(context.Background(), uuid.New())

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Len(t, result, 0)
}

func TestCategoryList_OrphanChild(t *testing.T) {
	userID := uuid.New()
	missingParentID := uuid.New()
	childID := uuid.New()

	mock := &mockCategoryStore{
		listCategoriesFn: func(ctx context.Context, uid uuid.UUID) ([]store.Category, error) {
			return []store.Category{
				{ID: childID, UserID: userID, Name: "Orphan", Type: "expense", ParentID: pgtype.UUID{Bytes: missingParentID, Valid: true}, CreatedAt: makeTimestamp()},
			}, nil
		},
	}

	svc := &Category{queries: mock}
	result, err := svc.List(context.Background(), userID)

	require.NoError(t, err)
	require.Len(t, result, 1)
	require.Equal(t, "Orphan", result[0].Name)
}

func TestCategoryDelete_HasChildren(t *testing.T) {
	mock := &mockCategoryStore{
		hasChildCategoriesFn: func(ctx context.Context, parentID pgtype.UUID) (bool, error) {
			return true, nil
		},
	}

	svc := &Category{queries: mock}
	err := svc.Delete(context.Background(), uuid.New(), uuid.New())

	require.ErrorIs(t, err, ErrCategoryHasChildren)
}

func TestCategoryDelete_HasTransactions(t *testing.T) {
	mock := &mockCategoryStore{
		hasChildCategoriesFn: func(ctx context.Context, parentID pgtype.UUID) (bool, error) {
			return false, nil
		},
		hasCategoryTransactionsFn: func(ctx context.Context, categoryID pgtype.UUID) (bool, error) {
			return true, nil
		},
	}

	svc := &Category{queries: mock}
	err := svc.Delete(context.Background(), uuid.New(), uuid.New())

	require.ErrorIs(t, err, ErrCategoryHasTransactions)
}

func TestCategoryDelete_Success(t *testing.T) {
	deleteCalled := false
	mock := &mockCategoryStore{
		hasChildCategoriesFn: func(ctx context.Context, parentID pgtype.UUID) (bool, error) {
			return false, nil
		},
		hasCategoryTransactionsFn: func(ctx context.Context, categoryID pgtype.UUID) (bool, error) {
			return false, nil
		},
		deleteCategoryFn: func(ctx context.Context, arg store.DeleteCategoryParams) error {
			deleteCalled = true
			return nil
		},
	}

	svc := &Category{queries: mock}
	err := svc.Delete(context.Background(), uuid.New(), uuid.New())

	require.NoError(t, err)
	require.True(t, deleteCalled)
}
