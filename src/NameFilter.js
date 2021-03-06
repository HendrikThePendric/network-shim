import React, { useState } from 'react';
import propTypes from 'prop-types';

export const NameFilter = ({ fetch }) => {
    const [filter, setFilter] = useState('');

    return (
        <div>
            <input
                className="filter-input"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
            <button
                className="filter-button-filter"
                type="button"
                onClick={() => fetch(filter)}
            >
                Filter
            </button>
            <button
                className="filter-button-clear"
                type="button"
                onClick={() => fetch()}
            >
                Clear
            </button>
        </div>
    );
};

NameFilter.propTypes = {
    add: propTypes.func,
};
