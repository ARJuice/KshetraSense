import pytest
from pyproj import Transformer

from app.spatial import SpatialValidationError, discretize_field


def _boundary_from_utm_rings(rings: list[list[tuple[float, float]]]) -> dict:
    to_wgs84 = Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True)
    return {
        "type": "Polygon",
        "coordinates": [
            [[*to_wgs84.transform(easting, northing)] for easting, northing in ring]
            for ring in rings
        ],
    }


def test_discretize_field_returns_metric_grid_cells_inside_square_boundary():
    boundary = _boundary_from_utm_rings(
        [[(500_000, 1_400_000), (500_100, 1_400_000), (500_100, 1_400_100), (500_000, 1_400_100), (500_000, 1_400_000)]]
    )

    field = discretize_field(boundary, cell_size_m=10)

    assert field.utm_crs == "EPSG:32643"
    assert field.area_hectares == pytest.approx(1.0, abs=1e-6)
    assert len(field.cells) == 100
    assert len({cell.id for cell in field.cells}) == 100
    assert all(cell.area_m2 == pytest.approx(100.0, abs=1e-5) for cell in field.cells)
    assert min(cell.row for cell in field.cells) == 0
    assert min(cell.column for cell in field.cells) == 0


def test_discretize_field_excludes_cell_centers_inside_polygon_holes():
    boundary = _boundary_from_utm_rings(
        [
            [(500_000, 1_400_000), (500_100, 1_400_000), (500_100, 1_400_100), (500_000, 1_400_100), (500_000, 1_400_000)],
            [(500_040, 1_400_040), (500_060, 1_400_040), (500_060, 1_400_060), (500_040, 1_400_060), (500_040, 1_400_040)],
        ]
    )

    field = discretize_field(boundary, cell_size_m=10)

    assert len(field.cells) == 96
    assert all(not (4 <= cell.row < 6 and 4 <= cell.column < 6) for cell in field.cells)


def test_discretize_field_rejects_self_intersecting_polygon():
    boundary = _boundary_from_utm_rings(
        [[(500_000, 1_400_000), (500_100, 1_400_100), (500_000, 1_400_100), (500_100, 1_400_000), (500_000, 1_400_000)]]
    )

    with pytest.raises(SpatialValidationError, match="valid, non-self-intersecting"):
        discretize_field(boundary, cell_size_m=10)


def test_discretize_field_covers_full_boundary_without_edge_gaps():
    # Boundary not an exact multiple of 10m (131.6m x 134.1m)
    boundary = _boundary_from_utm_rings(
        [[(500_000, 1_400_000), (500_131.6, 1_400_000), (500_131.6, 1_400_134.1), (500_000, 1_400_134.1), (500_000, 1_400_000)]]
    )

    field = discretize_field(boundary, cell_size_m=10)

    # 14 columns x 14 rows = 196 cells fully tessellating the field
    assert len(field.cells) == 196
    total_cell_area = sum(cell.area_m2 for cell in field.cells)
    expected_area_m2 = 131.6 * 134.1
    assert total_cell_area == pytest.approx(expected_area_m2, rel=1e-5)
    # Check that rows 0..13 and columns 0..13 are all present
    assert {cell.row for cell in field.cells} == set(range(14))
    assert {cell.column for cell in field.cells} == set(range(14))


def test_discretize_field_rejects_boundary_with_no_usable_cells():
    # Microscopic polygon (1mm x 1mm, area = 1e-6 m2)
    boundary = _boundary_from_utm_rings(
        [[(500_000, 1_400_000), (500_000.001, 1_400_000), (500_000.001, 1_400_000.001), (500_000, 1_400_000.001), (500_000, 1_400_000)]]
    )

    with pytest.raises(SpatialValidationError, match="contains no cell centers"):
        discretize_field(boundary, cell_size_m=10)


def test_discretize_field_cell_geometries_are_strictly_polygons():
    # Triangle boundary creating partial triangular and clipped cells
    boundary = _boundary_from_utm_rings(
        [[(500_000, 1_400_000), (500_050, 1_400_000), (500_000, 1_400_050), (500_000, 1_400_000)]]
    )

    field = discretize_field(boundary, cell_size_m=10)
    assert len(field.cells) > 0
    for cell in field.cells:
        geom_type = cell.geometry_wgs84.get("type")
        assert geom_type in ("Polygon", "MultiPolygon"), f"Unexpected geom type {geom_type}"


