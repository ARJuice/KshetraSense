import numpy as np
import pytest
from shapely.geometry import Polygon, Point

from app.spatial import GridCell
from app.wsn_placement import place_wsn_nodes


def _cell(cell_id: str, x: float, y: float) -> GridCell:
    return GridCell(
        id=cell_id,
        row=0,
        column=0,
        center_utm=(x, y),
        center_wgs84=(x, y),
        area_m2=100.0,
        geometry_wgs84={"type": "Polygon", "coordinates": [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]]},
    )


def test_each_contiguous_zone_gets_a_real_cell_medoid():
    cells = [_cell("a", 0, 0), _cell("b", 1, 0), _cell("c", 10, 0), _cell("d", 11, 0)]
    boundary = Polygon([(-1, -1), (12, -1), (12, 1), (-1, 1), (-1, -1)])

    placement = place_wsn_nodes(cells, np.array([0, 0, 1, 1]), {0: 70.0, 1: 45.0}, boundary, "EPSG:32643")

    assert [node.cell_id for node in placement.wsn_nodes] == ["a", "c"]
    assert placement.cluster_head.algorithm == "weiszfeld_geometric_median_projected_to_field"
    assert placement.cluster_head.radio_coverage_validated is False
    assert placement.cluster_head.position_utm == pytest.approx((5.0, 0.0))


def test_gateway_candidate_is_projected_inside_concave_field_boundary():
    cells = [_cell("a", 0, 0), _cell("b", 10, 0), _cell("c", 10, 10)]
    boundary = Polygon([(0, 0), (12, 0), (12, 2), (2, 2), (2, 12), (0, 12), (0, 0)])

    placement = place_wsn_nodes(cells, np.array([0, 0, 1]), {0: 70.0, 1: 55.0}, boundary, "EPSG:32643")

    point = Point(*placement.cluster_head.position_utm)
    assert boundary.covers(point)
