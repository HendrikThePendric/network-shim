import React, { useState, useEffect } from 'react';
import propTypes from 'prop-types';

export const AddUpdateName = ({ submit, clear, selectedName }) => {
    const [name, setName] = useState('');
    const onClick = () => {
        submit(name);
        setName('');
    };

    useEffect(() => {
        setName(selectedName || '');
    }, [selectedName]);

    return (
        <div>
            <input
                className="add-update-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <button
                className="add-update-button-confirm"
                type="button"
                onClick={onClick}
            >
                {selectedName ? 'Update' : 'Add'}
            </button>
            {selectedName && (
                <button
                    className="add-update-button-clear"
                    type="button"
                    onClick={clear}
                >
                    Clear selected
                </button>
            )}
        </div>
    );
};

AddUpdateName.propTypes = {
    submit: propTypes.func.isRequired,
    clear: propTypes.func.isRequired,
    selectedName: propTypes.string,
};
