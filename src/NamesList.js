import React from 'react';
import propTypes from 'prop-types';

export const NamesList = ({
    names,
    setSelectedName,
    deleteName,
    selectedId,
}) => (
    <ul className="list">
        {names.map((name) => (
            <li
                key={name.id}
                onClick={() => setSelectedName(name)}
                className={
                    name.id === selectedId ? 'list-item selected' : 'list-item'
                }
            >
                {name.name}
                <button type="button" onClick={() => deleteName(name.id)}>
                    Delete
                </button>
            </li>
        ))}
    </ul>
);

NamesList.propTypes = {
    names: propTypes.arrayOf(
        propTypes.shape({
            id: propTypes.number,
            name: propTypes.string,
        })
    ).isRequired,
    setSelectedName: propTypes.func.isRequired,
    deleteName: propTypes.func.isRequired,
    selectedId: propTypes.number,
};
