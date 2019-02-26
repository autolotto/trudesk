/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Chris Brame
 *  Updated:    2/24/19 2:05 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'

import $ from 'jquery'
import helpers from 'lib/helpers'

class MultiSelect extends React.Component {
  componentDidMount () {
    const $select = $(this.select)
    helpers.UI.multiSelect()

    if (this.props.initialSelected) {
      $select.multiSelect('select', this.props.initialSelected)
      $select.multiSelect('refresh')
    }
  }

  getSelected () {
    const $select = $(this.select)
    if (!$select) return []
    return $select.val()
  }

  render () {
    const { id, items } = this.props
    return (
      <select id={id} multiple={'multiple'} className={'multiselect'} ref={r => (this.select = r)}>
        {items &&
          items.map((item, i) => {
            return (
              <option key={i} value={item.value}>
                {item.text}
              </option>
            )
          })}
      </select>
    )
  }
}

MultiSelect.propTypes = {
  id: PropTypes.string,
  items: PropTypes.array.isRequired,
  initialSelected: PropTypes.array,
  onChange: PropTypes.func.isRequired
}

export default MultiSelect
